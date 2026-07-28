# Experiencia móvil de /analyze — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que `/analyze` (y la navegación global del área autenticada/anónima) se sienta como una app móvil: bottom tab bar, captura de foto vía cámara nativa, preview con rotación, skeleton de carga, hero card + filtros por veredicto en resultados.

**Architecture:** Next.js 16 App Router, todo client-side sobre datos que ya produce `/api/analyze` (sin cambios de schema/API/pipeline). Componentes nuevos y pequeños, cada uno con una responsabilidad: navegación (`BottomTabBar`), captura+preview (`FilePreviewStrip` + `rotateImageFile`), estado de carga (`AnalyzeSkeleton`), y presentación de resultados (`AnalyzeHeroCard`, `VerdictFilterChips`).

**Tech Stack:** React 19 + TypeScript strict, Tailwind v4 (tokens de marca ya definidos en `globals.css`: `brand`, `brand-dark`, `brand-darker`, `brand-soft`, `brand-on-soft`, `accent-soft`, `accent-dark`), Canvas API nativa (sin librería nueva), Vitest para la única función pura testeable.

## Global Constraints

- Spec de referencia: `docs/superpowers/specs/2026-07-28-analyze-mobile-ux-design.md`.
- Cero cambios en `src/schemas`, `src/app/api`, `src/lib/llm`, `src/lib/nutrition` — esto es UI pura.
- Cero dependencias nuevas de npm (Canvas API nativa, sin librería de iconos, sin librería de gráficos, sin librería de crop).
- Recorte manual de imagen: fuera de alcance (solo rotar 90°).
- Reusar los tokens de color ya definidos (`bg-brand-dark`, `text-brand-dark`, `bg-brand-soft`, `text-brand-on-soft`, `bg-accent-soft`, `text-accent-dark`) — no inventar colores nuevos ad-hoc. Los colores del semáforo verdict (`bg-green-500`/`bg-amber-500`/`bg-red-500` en `dish-result-card.tsx`) no se tocan.
- `rotateImageFile` depende de Canvas API del navegador: no es testeable en Vitest (entorno `node`, sin jsdom/canvas). Solo `rotatedDimensions` (la parte pura sin Canvas) lleva test automatizado; el resto se valida manualmente en navegador (Playwright, viewport móvil).
- **Desviación respecto al spec, encontrada al planificar:** la spec (sección 3.6) decía que el badge "Modo invitado" viviría dentro de `/profile` para usuarios anónimos. Pero `(app)/profile/page.tsx:17` ya hace `if (!user) redirect("/login")`, y `src/lib/supabase/middleware.ts:4` gatea `/profile` para anónimos — nunca llegan a ver esa página. Cambiar ese gateo es un cambio de alcance mayor (afecta el modelo de auth, no solo la UI) y no se hace aquí. **Corrección:** la sección "Cuenta" en `/profile` (Task 10) solo cubre el caso autenticado (email + logout). El mensaje de modo invitado sigue viviendo donde ya vive hoy — inline en el formulario de perfil anónimo dentro de `analyze-client.tsx` ("Modo invitado: este perfil no se guarda, solo vive en esta pestaña.") — y no se duplica en `/profile`, que sigue redirigiendo a `/login` para anónimos (comportamiento sin cambios).
- No usar `git commit --amend` ni `--no-verify`. Commits sin trailer `Co-Authored-By` (regla del proyecto).
- Verificar `npx tsc --noEmit` y `npm run build` limpios después de cada tarea que toque código.

---

### Task 1: `rotateImageFile` — rotación de imagen client-side

**Files:**
- Create: `src/lib/image/rotate-image-file.ts`
- Test: `src/lib/image/rotate-image-file.test.ts`

**Interfaces:**
- Consumes: nada (función de librería pura + Canvas API del navegador).
- Produces: `export type RotationDegrees = 90 | 180 | 270`, `export function rotatedDimensions(width: number, height: number, degrees: RotationDegrees): { width: number; height: number }`, `export async function rotateImageFile(file: File, degrees: RotationDegrees): Promise<File>`. Task 2 (`FilePreviewStrip`) importa `rotateImageFile` y `RotationDegrees`.

- [ ] **Step 1: Escribir el test que falla (solo para `rotatedDimensions`, la parte sin Canvas)**

```typescript
// src/lib/image/rotate-image-file.test.ts
import { describe, expect, it } from "vitest";
import { rotatedDimensions } from "./rotate-image-file";

describe("rotatedDimensions", () => {
  it("intercambia ancho y alto para 90 grados", () => {
    expect(rotatedDimensions(800, 600, 90)).toEqual({ width: 600, height: 800 });
  });

  it("intercambia ancho y alto para 270 grados", () => {
    expect(rotatedDimensions(800, 600, 270)).toEqual({ width: 600, height: 800 });
  });

  it("mantiene ancho y alto para 180 grados", () => {
    expect(rotatedDimensions(800, 600, 180)).toEqual({ width: 800, height: 600 });
  });
});
```

- [ ] **Step 2: Ejecutar el test y confirmar que falla**

Run: `npx vitest run src/lib/image/rotate-image-file.test.ts`
Expected: FAIL — `Cannot find module './rotate-image-file'` (el archivo de implementación no existe todavía).

- [ ] **Step 3: Implementación mínima**

```typescript
// src/lib/image/rotate-image-file.ts
export type RotationDegrees = 90 | 180 | 270;

export function rotatedDimensions(
  width: number,
  height: number,
  degrees: RotationDegrees
): { width: number; height: number } {
  return degrees === 180 ? { width, height } : { width: height, height: width };
}

/** Rota un File de imagen client-side vía Canvas. No soporta PDF (llamar solo con image/*). */
export async function rotateImageFile(file: File, degrees: RotationDegrees): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = rotatedDimensions(bitmap.width, bitmap.height, degrees);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas no soportado en este navegador.");
  }

  ctx.translate(width / 2, height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("No se pudo generar la imagen rotada."))),
      file.type
    );
  });

  return new File([blob], file.name, { type: file.type });
}
```

- [ ] **Step 4: Ejecutar el test y confirmar que pasa**

Run: `npx vitest run src/lib/image/rotate-image-file.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/lib/image/rotate-image-file.ts src/lib/image/rotate-image-file.test.ts
git commit -m "feat: rotateImageFile — rotacion client-side de fotos de carta (Canvas API)"
```

---

### Task 2: `FilePreviewStrip` — miniaturas con rotar/quitar

**Files:**
- Create: `src/components/features/file-preview-strip.tsx`

**Interfaces:**
- Consumes: `rotateImageFile`, `RotationDegrees` de `src/lib/image/rotate-image-file.ts` (Task 1).
- Produces: `export function FilePreviewStrip({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }): JSX.Element | null`. Task 6 (`analyze-client.tsx`) lo consume así.

- [ ] **Step 1: Escribir el componente**

```typescript
// src/components/features/file-preview-strip.tsx
"use client";

import { useEffect, useState } from "react";
import { rotateImageFile } from "@/lib/image/rotate-image-file";

export function FilePreviewStrip({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const [urls, setUrls] = useState<string[]>([]);
  const [rotateError, setRotateError] = useState<string | null>(null);

  useEffect(() => {
    const next = files.map((f) => (f.type === "application/pdf" ? "" : URL.createObjectURL(f)));
    setUrls(next);
    return () => {
      next.forEach((u) => u && URL.revokeObjectURL(u));
    };
  }, [files]);

  async function handleRotate(index: number) {
    try {
      const rotated = await rotateImageFile(files[index], 90);
      const next = files.slice();
      next[index] = rotated;
      setRotateError(null);
      onChange(next);
    } catch {
      setRotateError("No se pudo rotar esta imagen.");
    }
  }

  function handleRemove(index: number) {
    onChange(files.filter((_, i) => i !== index));
  }

  if (files.length === 0) return null;

  return (
    <div className="space-y-1">
      {rotateError && <p className="text-xs text-red-700 dark:text-red-400">{rotateError}</p>}
      <div className="flex gap-2 overflow-x-auto py-2">
      {files.map((file, i) => (
        <div key={i} className="shrink-0 text-center">
          {file.type === "application/pdf" ? (
            <div className="flex h-20 w-20 items-center justify-center rounded-md border border-foreground/20 text-xs font-medium text-foreground/60">
              PDF
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={urls[i]}
              alt=""
              className="h-20 w-20 rounded-md border border-foreground/20 object-cover"
            />
          )}
          <div className="mt-1 flex justify-center gap-1">
            {file.type !== "application/pdf" && (
              <button
                type="button"
                onClick={() => handleRotate(i)}
                aria-label="Rotar imagen 90 grados"
                className="rounded bg-foreground/10 px-1.5 py-0.5 text-xs"
              >
                ↻
              </button>
            )}
            <button
              type="button"
              onClick={() => handleRemove(i)}
              aria-label="Quitar archivo"
              className="rounded bg-foreground/10 px-1.5 py-0.5 text-xs"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores. (No hay test automatizado — es un componente visual sin lógica de negocio pura más allá de lo ya cubierto por `rotateImageFile`; se valida en Task 11 con Playwright.)

- [ ] **Step 3: Commit**

```bash
git add src/components/features/file-preview-strip.tsx
git commit -m "feat: FilePreviewStrip - miniaturas con rotar y quitar antes de analizar"
```

---

### Task 3: `AnalyzeSkeleton` — estado de carga

**Files:**
- Create: `src/components/features/analyze-skeleton.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: `export function AnalyzeSkeleton(): JSX.Element` — sin props. Task 6 lo renderiza cuando `status === "loading"`.

- [ ] **Step 1: Escribir el componente**

```typescript
// src/components/features/analyze-skeleton.tsx
export function AnalyzeSkeleton() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-10">
      <p className="text-sm text-foreground/60">Analizando carta… puede tardar un minuto.</p>
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-lg border border-foreground/10 p-4">
            <div className="flex items-center justify-between">
              <div className="h-4 w-40 rounded bg-foreground/10" />
              <div className="h-4 w-16 rounded bg-foreground/10" />
            </div>
            <div className="mt-3 h-3 w-full rounded bg-foreground/10" />
            <div className="mt-2 h-3 w-2/3 rounded bg-foreground/10" />
          </div>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/features/analyze-skeleton.tsx
git commit -m "feat: AnalyzeSkeleton - tarjetas fantasma durante el analisis"
```

---

### Task 4: `AnalyzeHeroCard` — resumen + barra de proporción

**Files:**
- Create: `src/components/features/analyze-hero-card.tsx`

**Interfaces:**
- Consumes: `AnalyzeResponse`, `Verdict` de `@/schemas` (ya existentes).
- Produces: `export function AnalyzeHeroCard({ dishes }: { dishes: AnalyzeResponse["dishes"] }): JSX.Element`. Task 7 (`analyze-results.tsx`) lo consume así.

- [ ] **Step 1: Escribir el componente**

```typescript
// src/components/features/analyze-hero-card.tsx
import type { AnalyzeResponse, Verdict } from "@/schemas";

const VERDICT_BAR_COLOR: Record<Verdict, string> = {
  green: "bg-green-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

export function AnalyzeHeroCard({ dishes }: { dishes: AnalyzeResponse["dishes"] }) {
  const counts: Record<Verdict, number> = { green: 0, amber: 0, red: 0 };
  for (const d of dishes) counts[d.verdict]++;
  const total = dishes.length || 1;

  return (
    <div className="rounded-lg border border-foreground/10 p-4">
      <p className="text-2xl font-semibold">
        {dishes.length} plato{dishes.length === 1 ? "" : "s"} analizados
      </p>
      <p className="text-sm text-foreground/60">{counts.green} en verde</p>
      <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-foreground/10">
        {(["green", "amber", "red"] as const).map((v) =>
          counts[v] > 0 ? (
            <div
              key={v}
              className={VERDICT_BAR_COLOR[v]}
              style={{ width: `${(counts[v] / total) * 100}%` }}
            />
          ) : null
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/features/analyze-hero-card.tsx
git commit -m "feat: AnalyzeHeroCard - resumen y barra de proporcion verde/ambar/rojo"
```

---

### Task 5: `VerdictFilterChips` — chips de filtro

**Files:**
- Create: `src/components/features/verdict-filter-chips.tsx`

**Interfaces:**
- Consumes: `AnalyzeResponse`, `Verdict` de `@/schemas`.
- Produces: `export type VerdictFilter = "all" | Verdict`; `export function VerdictFilterChips({ dishes, value, onChange }: { dishes: AnalyzeResponse["dishes"]; value: VerdictFilter; onChange: (v: VerdictFilter) => void }): JSX.Element`. Task 7 consume `VerdictFilter` y el componente.

- [ ] **Step 1: Escribir el componente**

```typescript
// src/components/features/verdict-filter-chips.tsx
import type { AnalyzeResponse, Verdict } from "@/schemas";

export type VerdictFilter = "all" | Verdict;

const FILTER_LABEL: Record<VerdictFilter, string> = {
  all: "Todos",
  green: "Verde",
  amber: "Ámbar",
  red: "Rojo",
};

const FILTERS: VerdictFilter[] = ["all", "green", "amber", "red"];

export function VerdictFilterChips({
  dishes,
  value,
  onChange,
}: {
  dishes: AnalyzeResponse["dishes"];
  value: VerdictFilter;
  onChange: (v: VerdictFilter) => void;
}) {
  const counts: Record<VerdictFilter, number> = {
    all: dishes.length,
    green: dishes.filter((d) => d.verdict === "green").length,
    amber: dishes.filter((d) => d.verdict === "amber").length,
    red: dishes.filter((d) => d.verdict === "red").length,
  };

  return (
    <div className="flex gap-2 overflow-x-auto">
      {FILTERS.map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => onChange(f)}
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            value === f
              ? "border-brand-dark bg-brand-soft text-brand-on-soft"
              : "border-foreground/15 text-foreground/60"
          }`}
        >
          {FILTER_LABEL[f]} ({counts[f]})
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/features/verdict-filter-chips.tsx
git commit -m "feat: VerdictFilterChips - filtrar resultados por veredicto"
```

---

### Task 6: Integrar cámara + preview + skeleton en `analyze-client.tsx`

**Files:**
- Modify: `src/components/features/analyze-client.tsx` (reemplaza el bloque de upload de las líneas 150-165 y añade la rama de loading antes de la línea 117)

**Interfaces:**
- Consumes: `FilePreviewStrip` (Task 2), `AnalyzeSkeleton` (Task 3).
- Produces: sin cambios en la interfaz pública del componente (`AnalyzeClient({ initialProfile, isAuthenticated })`), solo cambia su render interno.

- [ ] **Step 1: Añadir imports y refs para los dos inputs**

En `src/components/features/analyze-client.tsx`, sustituir el import bloque inicial:

```typescript
"use client";

import { useRef, useState } from "react";
import { useSessionStore, readAnonymousProfile } from "@/stores/session-store";
import { ProfileForm } from "@/components/features/profile-form";
import { AnalyzeResults } from "@/components/features/analyze-results";
import { AnalyzeSkeleton } from "@/components/features/analyze-skeleton";
import { FilePreviewStrip } from "@/components/features/file-preview-strip";
import { targets } from "@/lib/nutrition/targets";
import type { Profile, Goal, AnalyzeResponse } from "@/schemas";
```

- [ ] **Step 2: Reemplazar `handleFiles` por `addFiles`/`handleCameraCapture`/`handleGallerySelect` y añadir refs**

Sustituir la función `handleFiles` (líneas 65-75 del archivo actual) por:

```typescript
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  function validateAndSet(newFiles: File[]): boolean {
    const invalid = newFiles.find((f) => !ACCEPTED_TYPES.has(f.type));
    if (invalid) {
      setErrorMsg(`Tipo no soportado: ${invalid.type || invalid.name}`);
      return false;
    }
    setErrorMsg(null);
    return true;
  }

  function handleCameraCapture(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const captured = Array.from(fileList);
    if (!validateAndSet(captured)) return;
    setFiles((prev) => [...prev, ...captured].slice(0, MAX_FILES));
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  function handleGallerySelect(fileList: FileList | null) {
    if (!fileList) return;
    const arr = Array.from(fileList).slice(0, MAX_FILES);
    if (!validateAndSet(arr)) return;
    setFiles(arr);
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  }
```

- [ ] **Step 3: Añadir la rama de loading (antes del `if (status === "done" && result)` existente)**

```typescript
  if (status === "loading") {
    return <AnalyzeSkeleton />;
  }

```

- [ ] **Step 4: Reemplazar el bloque de upload (input único + texto plano) por los dos controles + preview**

Sustituir el bloque:

```typescript
      <div className="space-y-1">
        <label htmlFor="files" className="text-sm font-medium">
          Foto(s) o PDF de la carta (1-4)
        </label>
        <input
          id="files"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => handleFiles(e.target.files)}
          className="w-full text-sm"
        />
        {files.length > 0 && (
          <p className="text-xs text-foreground/60">{files.length} archivo(s) seleccionados.</p>
        )}
      </div>
```

por:

```typescript
      <div className="space-y-2">
        <p className="text-sm font-medium">Foto(s) o PDF de la carta (1-4)</p>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => handleCameraCapture(e.target.files)}
          className="hidden"
        />
        <input
          ref={galleryInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => handleGallerySelect(e.target.files)}
          className="hidden"
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex-1 rounded-md border border-brand-dark/50 px-3 py-2 text-sm font-medium text-brand-dark transition-colors hover:bg-brand-soft"
          >
            Hacer foto
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="flex-1 rounded-md border border-foreground/20 px-3 py-2 text-sm font-medium transition-colors hover:bg-foreground/5"
          >
            Elegir archivos
          </button>
        </div>

        <FilePreviewStrip files={files} onChange={setFiles} />
      </div>
```

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores. (`handleFiles` ya no existe; confirmar que no queda ninguna referencia residual.)

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: build limpio, rutas sin cambios.

- [ ] **Step 7: Commit**

```bash
git add src/components/features/analyze-client.tsx
git commit -m "feat: camara nativa + preview/rotar + skeleton en flujo de analyze"
```

---

### Task 7: Integrar hero card + chips de filtro en `analyze-results.tsx`

**Files:**
- Modify: `src/components/features/analyze-results.tsx`

**Interfaces:**
- Consumes: `AnalyzeHeroCard` (Task 4), `VerdictFilterChips` + `VerdictFilter` (Task 5).
- Produces: sin cambios en la interfaz pública (`AnalyzeResults({ result, onReset })`).

- [ ] **Step 1: Añadir imports y estado de filtro**

```typescript
"use client";

import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { DishResultCard } from "@/components/features/dish-result-card";
import { AnalyzeHeroCard } from "@/components/features/analyze-hero-card";
import { VerdictFilterChips, type VerdictFilter } from "@/components/features/verdict-filter-chips";
import type { AnalyzeResponse } from "@/schemas";

export function AnalyzeResults({
  result,
  onReset,
}: {
  result: AnalyzeResponse;
  onReset: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<VerdictFilter>("all");
  const filteredDishes =
    filter === "all" ? result.dishes : result.dishes.filter((d) => d.verdict === filter);
```

- [ ] **Step 2: Actualizar el `useGSAP` para depender también del filtro (re-anima al cambiar de chip)**

```typescript
  useGSAP(
    () => {
      gsap.from(".dish-card", {
        opacity: 0,
        y: 16,
        duration: 0.4,
        stagger: 0.06,
        ease: "power2.out",
      });
    },
    { scope: containerRef, dependencies: [result, filter] }
  );
```

- [ ] **Step 3: Insertar `AnalyzeHeroCard` y `VerdictFilterChips`, y usar `filteredDishes` en vez de `result.dishes` en la lista**

Reemplazar el bloque final del `return` (desde el `<div className="flex items-center justify-between">` hasta el cierre de `</main>`) por:

```typescript
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Resultado</h2>
        <button
          type="button"
          onClick={onReset}
          className="text-sm text-foreground/60 underline underline-offset-2"
        >
          Analizar otra carta
        </button>
      </div>

      {!result.menuReadOk && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          No se pudo leer la carta. {result.notes}
        </p>
      )}
      {result.menuReadOk && result.notes && (
        <p className="text-sm text-foreground/60">{result.notes}</p>
      )}

      <AnalyzeHeroCard dishes={result.dishes} />
      <VerdictFilterChips dishes={result.dishes} value={filter} onChange={setFilter} />

      {filteredDishes.length === 0 ? (
        <p className="rounded-md border border-foreground/10 px-4 py-6 text-center text-sm text-foreground/60">
          Ningún plato en esta categoría.
        </p>
      ) : (
        <div className="space-y-3">
          {filteredDishes.map((dish) => (
            <DishResultCard key={`${dish.name}-${dish.nutritionQuery}`} dish={dish} />
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build limpio.

- [ ] **Step 6: Commit**

```bash
git add src/components/features/analyze-results.tsx
git commit -m "feat: hero card + chips de filtro por veredicto en resultados"
```

---

### Task 8: `BottomTabBar` — navegación inferior con iconos

**Files:**
- Create: `src/components/features/bottom-tab-bar.tsx`

**Interfaces:**
- Consumes: `usePathname` de `next/navigation`, `Link` de `next/link` (ya usados en el proyecto).
- Produces: `export function BottomTabBar(): JSX.Element` — sin props (lee la ruta actual internamente). Task 9 (`(app)/layout.tsx`) lo consume así.

- [ ] **Step 1: Escribir el componente**

```typescript
// src/components/features/bottom-tab-bar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function AnalyzeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path
        d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2M20 8V6a2 2 0 0 0-2-2h-2M20 16v2a2 2 0 0 1-2 2h-2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProfileIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <circle cx="12" cy="8" r="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <circle cx="12" cy="12" r="8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TABS: Array<{ href: string; label: string; Icon: typeof AnalyzeIcon }> = [
  { href: "/analyze", label: "Analizar", Icon: AnalyzeIcon },
  { href: "/profile", label: "Perfil", Icon: ProfileIcon },
  { href: "/history", label: "Historial", Icon: HistoryIcon },
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 flex border-t border-foreground/10 bg-background pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegación principal"
    >
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors ${
              active ? "text-brand-dark" : "text-foreground/50"
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/features/bottom-tab-bar.tsx
git commit -m "feat: BottomTabBar - navegacion inferior con iconos inline"
```

---

### Task 9: Sustituir el header por `BottomTabBar` en `(app)/layout.tsx`

**Files:**
- Modify: `src/app/(app)/layout.tsx` (reescritura completa del archivo, 41 líneas → más corto)

**Interfaces:**
- Consumes: `BottomTabBar` (Task 8).
- Produces: sin cambios en la interfaz pública (`AppLayout({ children })`), pero dejará de renderizar el bloque `user`/`signOut`/nav-links — esa lógica se traslada a Task 10.

- [ ] **Step 1: Reescribir el archivo completo**

```typescript
// src/app/(app)/layout.tsx
import { BottomTabBar } from "@/components/features/bottom-tab-bar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-foreground/10 px-4 py-3">
        <span className="text-sm font-semibold text-brand">ORDR</span>
      </header>
      <div className="flex-1 pb-20">{children}</div>
      <BottomTabBar />
    </div>
  );
}
```

Nota: `AppLayout` deja de ser `async` y deja de importar `createClient`/`signOut` — ya no necesita la sesión de Supabase (ni la petición de `getUser()` extra en cada navegación). Esa consulta se hace ahora únicamente donde hace falta: `(app)/profile/page.tsx` ya llama a `supabase.auth.getUser()` por su cuenta (Task 10).

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build limpio, las rutas `/analyze`, `/profile`, `/history` siguen listadas.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/layout.tsx"
git commit -m "feat: header minimo + bottom tab bar en el area (app)"
```

---

### Task 10: Sección "Cuenta" (email + logout) en `(app)/profile/page.tsx`

**Files:**
- Modify: `src/app/(app)/profile/page.tsx`

**Interfaces:**
- Consumes: `signOut` de `../actions` (ya existe, sin cambios — antes solo se usaba en `(app)/layout.tsx`, que ya no lo importa tras Task 9).
- Produces: sin cambios en la interfaz pública de la página.

- [ ] **Step 1: Añadir el import de `signOut` y la sección "Cuenta"**

En `src/app/(app)/profile/page.tsx`, añadir el import:

```typescript
import { signOut } from "../actions";
```

Y sustituir el `return` actual:

```typescript
  return (
    <div>
      {params.saved && (
```

por:

```typescript
  return (
    <div>
      <div className="mx-auto mt-6 flex max-w-lg items-center justify-between rounded-md border border-foreground/10 px-4 py-3 text-sm">
        <span className="text-foreground/70">{user.email}</span>
        <form action={signOut}>
          <button type="submit" className="text-foreground/60 underline underline-offset-2">
            Salir
          </button>
        </form>
      </div>

      {params.saved && (
```

(El resto del archivo, desde `{params.saved && (` hasta el final, no cambia.)

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/profile/page.tsx"
git commit -m "feat: seccion Cuenta (email + logout) en /profile tras quitar el header global"
```

---

### Task 11: Verificación final end-to-end

**Files:** ninguno (solo verificación).

**Interfaces:** N/A.

- [ ] **Step 1: Verificación estática**

Run: `npx tsc --noEmit && npm run build && npx vitest run`
Expected: los tres comandos terminan sin errores; el build lista `/analyze`, `/profile`, `/history`, `/api/analyze`, `/api/analyses`, `/api/analyses/[id]`, `/login`, `/signup` igual que antes.

- [ ] **Step 2: Levantar el dev server**

Run: `npm run dev`
Expected: servidor arriba en `http://localhost:3000`.

- [ ] **Step 3: Verificación manual en navegador — viewport móvil (390×844)**

Usar Playwright (`browser_resize` a 390×844 o el emulador de dispositivo del navegador) y comprobar:

1. En `/analyze`, `/profile` (autenticado) y `/history`: la bottom tab bar es visible, fija abajo, y el tab correspondiente a la ruta actual se ve resaltado (`text-brand-dark`) vs los otros dos (`text-foreground/50`).
2. En `/analyze` (con perfil ya resuelto): existen dos botones "Hacer foto" y "Elegir archivos"; el input de cámara tiene los atributos `accept="image/*"` y `capture="environment"` (inspeccionar el DOM); el input de galería sigue aceptando `image/jpeg,image/png,image/webp,application/pdf` con `multiple`.
3. Seleccionar una imagen de prueba vía "Elegir archivos": aparece la miniatura en `FilePreviewStrip`, con botones rotar (↻) y quitar (✕). Pulsar rotar y confirmar que la miniatura cambia de orientación sin error en consola.
4. Enviar un análisis real contra `/api/analyze` con una carta de prueba: mientras `status === "loading"`, se ven las 4 tarjetas fantasma con `animate-pulse` (no el botón deshabilitado como único indicador).
5. Al completarse: aparece `AnalyzeHeroCard` (nº de platos, nº en verde, barra de 3 colores) y `VerdictFilterChips` debajo. Pulsar cada chip (Verde/Ámbar/Rojo/Todos) y confirmar que la lista se filtra correctamente y que el conteo en cada chip coincide con lo mostrado.
6. En `/profile` (autenticado): se ve la sección "Cuenta" arriba del todo con el email y un botón "Salir" que funciona (reutiliza el flujo de logout ya validado en Sprint 4).
7. `mcp__plugin_playwright_playwright__browser_console_messages` con `level: "warning"`: 0 errores nuevos (los warnings de precarga de fuente ya conocidos, si aparecen, no cuentan como regresión).

- [ ] **Step 4: Limpieza**

Detener el dev server y borrar cualquier archivo de prueba temporal usado para el análisis (imágenes copiadas a `.playwright-mcp/`, capturas de pantalla), igual que en sprints anteriores.

- [ ] **Step 5: Actualizar el spec con el resultado de la verificación**

Añadir una línea al final de `docs/superpowers/specs/2026-07-28-analyze-mobile-ux-design.md` bajo un nuevo encabezado `## 8. Verificación` documentando qué se probó y el resultado (siguiendo el mismo estilo que las notas de validación en `SPRINTS.md`).

- [ ] **Step 6: Commit final**

```bash
git add docs/superpowers/specs/2026-07-28-analyze-mobile-ux-design.md
git commit -m "docs: verificacion end-to-end de la experiencia movil de /analyze"
```
