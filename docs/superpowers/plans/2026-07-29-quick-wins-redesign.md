# ORDR Quick Wins (scoring fix + rediseño visual base) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the scoring engine's 80-saturation bug and ship the audit's Quick Wins visual tranche — canvas crema palette (light+dark), Bricolage/Inter typography, and restyled hero donut, filter chips, dish cards, bottom nav, and loading stepper.

**Architecture:** Two independent CSS-token tasks (color, typography) land first since every later component consumes them. A shared `Ring` SVG primitive is extracted once and reused by both the hero donut (large, animated) and the per-dish mini score ring (small, static). The scoring fix is fully independent of the visual work and can run in any order relative to it, but is sequenced first per the spec's "bloqueante" framing.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS v4 (`@theme` CSS-first config, no `tailwind.config.js`), GSAP + `@gsap/react` (`useGSAP`), Vitest (`environment: "node"`, no DOM — component tasks have no automated tests, matching existing project convention).

## Global Constraints

- No cambios de esquema de datos en esta tanda — cero migraciones SQL.
- Dark mode (`@media (prefers-color-scheme: dark)`) se mantiene; no se elimina ni se pasa a class-based toggle.
- Reemplazo total de `Geist`/`Geist_Mono` por `Bricolage_Grotesque` (display) + `Inter` (UI/body) — ninguna referencia a Geist debe quedar en `layout.tsx` o `globals.css`.
- El dataset de 15-20 platos para recalibrar el scoring lo aporta el usuario durante la ejecución (Task 1, Step 1) — no inventar datos de platos reales.
- Todo par texto/fondo nuevo cumple WCAG AA (4.5:1 texto normal, 3:1 texto grande).
- `npx tsc --noEmit` y `npx vitest run` limpios al final de cada tarea; `npm run build` limpio al final del plan completo.
- Los tokens `--brand`/`--brand-dark`/`--brand-darker`/`--brand-soft`/`--brand-on-soft`/`--accent-soft`/`--accent-dark` (usados en Login/Signup/Profile/botones fuera del alcance de esta tanda) NO se tocan — los nuevos tokens de color conviven con ellos, no los reemplazan.

---

### Task 1: Fix del motor de scoring (bug bloqueante)

Este task depende de datos reales que el usuario debe aportar — no existen todavía en el momento de escribir este plan. Es, por diseño, un task con forma de `systematic-debugging` (recalibración contra casos reales), no un TDD estándar con valores ya conocidos.

**Files:**
- Modify: `src/lib/nutrition/scoring.ts:19-40` (constantes de `scoreDish`, nunca la firma)
- Modify (test): `src/lib/nutrition/scoring.test.ts` (se añaden casos, no se tocan los 10 existentes)

**Interfaces:**
- Consumes: nada de otras tareas de este plan.
- Produces: `scoreDish(m: Macros, t: Target, goal: Goal, hardRed: boolean): { verdict: Verdict; fitScore: number }` — firma sin cambios, ninguna tarea posterior depende de sus constantes internas.

- [ ] **Step 1: Pedir el dataset al usuario si no ha llegado ya**

Si no tienes ya una lista de 15-20 platos reales etiquetados, pausa y pregunta exactamente esto antes de escribir ningún código:

> "Para recalibrar el scoring necesito 15-20 platos reales. Por cada uno: nombre, kcal, proteína (g), carbohidratos (g), grasa (g), objetivo (cut/bulk/maintain), y qué veredicto (verde/ámbar/rojo) le darías tú. Si tienes una captura donde varios platos distintos puntúan 80 (el bug reportado), esos son los más útiles para empezar."

No continúes al Step 2 sin esta lista — inventar macros de platos "de ejemplo" arriesga construir un test que no reproduce el bug real y da una falsa sensación de progreso.

- [ ] **Step 2: Escribir un test por cada plato del dataset**

En `src/lib/nutrition/scoring.test.ts`, añade un `describe` nuevo (no toques los `describe("hasHardConflict", ...)` ni `describe("scoreDish", ...)` existentes) con un `it` por cada fila del dataset, siguiendo este patrón exacto por cada plato:

```ts
describe("scoreDish — casos reales (auditoria 2026-07-29)", () => {
  it("<nombre del plato> (<objetivo>) puntúa <verde|ámbar|rojo> según el usuario", () => {
    const m = { kcal: <kcal>, protein_g: <protein_g>, carbs_g: <carbs_g>, fat_g: <fat_g> };
    const t = { mealKcal: <mealKcal>, mealProtein: <mealProtein> };
    const { verdict } = scoreDish(m, t, "<goal>", false);
    expect(verdict).toBe("<veredicto esperado>");
  });
});
```

Para `mealKcal`/`mealProtein` (el target de la comida): si el usuario no dio un objetivo diario junto con el plato, usa `targets()` de `src/lib/nutrition/targets.ts` con un perfil de referencia razonable (p. ej. adulto activo moderado, 3 comidas/día) y el `goal` de esa fila.

- [ ] **Step 3: Confirmar qué falla**

Run: `npx vitest run src/lib/nutrition/scoring.test.ts`
Anota qué casos nuevos fallan contra las constantes actuales — eso es lo que hay que recalibrar.

- [ ] **Step 4: Ajustar constantes hasta que todo pase**

Las únicas constantes que se tocan, todas dentro de `scoreDish` (`src/lib/nutrition/scoring.ts:19-38`):

- Denominadores de los `clamp()`: `proteinPct / 0.4`, `fatPct / 0.45`, `kcalRatio / 1.2`, `(carbs_g*4/kcal) / 0.5`. Súbelos si el síntoma es que platos muy distintos siguen puntuando igual (el clamp llega a su techo de 1 demasiado pronto).
- Pesos por objetivo (cut: `0.5/0.3/0.2`, bulk: `0.45/0.35/0.2`, maintain: `0.5/0.3/0.2`). Sube el peso del término que, según el dataset, más debería pesar en discriminar.
- Umbrales de veredicto (línea 40: `s >= 70 ? green : s >= 45 ? amber : red`) — tócalos solo si tras ajustar lo anterior el rango de scores resultante no encaja con los cortes verde/ámbar/rojo reales del dataset.

Itera: cambia una constante, corre `npx vitest run src/lib/nutrition/scoring.test.ts`, repite. No sigas al siguiente step hasta que:
(a) todos los casos nuevos del dataset pasen, Y
(b) los 10 tests existentes de `hasHardConflict`/`scoreDish` (ya en el archivo, no tocados) sigan pasando — cero regresión.

- [ ] **Step 5: Confirmar suite completa**

Run: `npx vitest run`
Expected: todos los test files en verde, incluidos los nuevos.

- [ ] **Step 6: Commit**

```bash
git add src/lib/nutrition/scoring.ts src/lib/nutrition/scoring.test.ts
git commit -m "fix: recalibrar motor de scoring contra dataset real (auditoria 2026-07-29)"
```

---

### Task 2: Tokens de color (canvas crema + familia cromática, claro + oscuro)

**Files:**
- Modify: `src/app/globals.css:1-59` (completo)

**Interfaces:**
- Consumes: nada.
- Produces: variables CSS `--canvas`≡`--background`, `--ink`≡`--foreground` (mismos nombres que ya existían, valores nuevos), más `--surface`, `--surface-tint`, `--ink-soft`, `--line`, `--primary`, `--primary-deep`, `--accent-sun`, `--sem-green`/`--sem-green-bg`, `--sem-amber`/`--sem-amber-bg`, `--sem-red`/`--sem-red-bg`, `--grad-hero-from`/`--grad-hero-to`. Expuestas como utilidades Tailwind vía `@theme inline`: `bg-surface`, `text-ink`, `border-line`, `bg-primary`, `text-primary-deep`, `bg-accent-sun`, `bg-sem-green-bg`, `text-sem-green`, etc. Todas las tareas 5-9 consumen estas clases.

**Decisión de implementación (por qué no hay clases `dark:*`):** el proyecto ya resuelve dark mode reasignando el *valor* de las variables `:root` dentro de `@media (prefers-color-scheme: dark)` (ver `--brand`, `--background` actuales) — nunca con la variante `dark:` de Tailwind. Los tokens nuevos siguen el mismo patrón: un solo nombre de clase Tailwind, dos valores posibles según el media query. Esto también significa que **cambiar el valor de `--background`/`--foreground` arregla el "fondo negro puro" en toda la app gratis** (todo lo que ya usa `bg-background`/`text-foreground`/`text-foreground/60` etc. se actualiza solo), sin tocar ningún otro archivo.

- [ ] **Step 1: Reescribir `globals.css` completo**

```css
@import "tailwindcss";

/* Paleta de marca ORDR — regla 60-30-10: blanco/base (60%), verde (30%), amarillo (10%).
   Los colores del semáforo (verdict rojo/ambar/verde en DishResultCard) son semánticos y
   quedan fuera de esta paleta de marca a propósito: no deben confundirse con el acento visual.

   Contraste verificado (WCAG AA, 4.5:1 texto normal / 3:1 texto grande):
   - brand-dark (#047857) vs blanco = 5.49:1 -> texto/botones sobre fondo blanco.
   - brand-darker (#065f46) vs blanco = ~7:1 -> hover de botones.
   - accent-dark (#854d0e) vs accent-soft (#fef9c3) = 6.37:1 -> chips/badges.
   - brand (#059669) vs blanco = 3.77:1 -> solo texto GRANDE (logo) o decorativo, nunca texto normal.

   Auditoria 2026-07-29 (tanda Quick Wins) — canvas crema + familia cromatica ampliada.
   Conviven con brand/accent de arriba (sin tocar, gobiernan botones/CTA fuera de esta
   tanda): canvas/ink reemplazan background/foreground (arregla el "fondo negro puro" en
   toda la app via las mismas dos variables que body ya consumia); surface/line/primary/
   accent-sun/sem-* son nuevos, para Resultado/Analizar/nav.
   Contraste verificado (WCAG AA):
   - ink (#1e2620) vs canvas (#f7f4ec) = ~15:1 -> texto normal.
   - ink-soft (#5c665e) vs canvas (#f7f4ec) = ~5.3:1 -> texto normal.
   - sem-green (#22a45d) vs sem-green-bg (#e3f3e9) = ~3.4:1 -> solo texto GRANDE o badge con peso 600+; sem-amber/sem-red mismo patrón.
   - primary-deep (#166b3d) vs canvas (#f7f4ec) = ~7.9:1 -> texto/hover. */
:root {
  --background: #f7f4ec;
  --foreground: #1e2620;
  --brand: #059669;
  --brand-dark: #047857;
  --brand-darker: #065f46;
  --brand-soft: #ecfdf5;
  --brand-on-soft: #047857;
  --accent-soft: #fef9c3;
  --accent-dark: #854d0e;

  --surface: #ffffff;
  --surface-tint: #eff3ea;
  --ink-soft: #5c665e;
  --line: #e2dfd3;
  --primary: #22a45d;
  --primary-deep: #166b3d;
  --accent-sun: #f2c94c;
  --sem-green: #22a45d;
  --sem-green-bg: #e3f3e9;
  --sem-amber: #d9911f;
  --sem-amber-bg: #fbf0d9;
  --sem-red: #d14b3c;
  --sem-red-bg: #f9e4e0;
  --grad-hero-from: #dcefe2;
  --grad-hero-to: #f7f4ec;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-brand: var(--brand);
  --color-brand-dark: var(--brand-dark);
  --color-brand-darker: var(--brand-darker);
  --color-brand-soft: var(--brand-soft);
  --color-brand-on-soft: var(--brand-on-soft);
  --color-accent-soft: var(--accent-soft);
  --color-accent-dark: var(--accent-dark);

  --color-canvas: var(--background);
  --color-ink: var(--foreground);
  --color-surface: var(--surface);
  --color-surface-tint: var(--surface-tint);
  --color-ink-soft: var(--ink-soft);
  --color-line: var(--line);
  --color-primary: var(--primary);
  --color-primary-deep: var(--primary-deep);
  --color-accent-sun: var(--accent-sun);
  --color-sem-green: var(--sem-green);
  --color-sem-green-bg: var(--sem-green-bg);
  --color-sem-amber: var(--sem-amber);
  --color-sem-amber-bg: var(--sem-amber-bg);
  --color-sem-red: var(--sem-red);
  --color-sem-red-bg: var(--sem-red-bg);

  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #14181a;
    --foreground: #f4f1e8;
    --brand: #34d399;
    /* brand-dark/brand-darker se mantienen: son el relleno de botones (con texto blanco
       encima), su contraste depende de sí mismos, no del fondo de página. */
    --brand-soft: #052e1f;
    --brand-on-soft: #6ee7b7;
    /* accent-soft/accent-dark tampoco cambian: el chip lleva su propio fondo pálido siempre. */

    --surface: #1c221d;
    --surface-tint: #232b24;
    --ink-soft: #a9b3a6;
    --line: #2e362f;
    --primary: #34d399;
    --primary-deep: #4ade80;
    --accent-sun: #f2c94c;
    --sem-green: #4ade80;
    --sem-green-bg: #123321;
    --sem-amber: #f5a623;
    --sem-amber-bg: #332405;
    --sem-red: #f87171;
    --sem-red-bg: #3b1512;
    --grad-hero-from: #16241c;
    --grad-hero-to: #14181a;
  }
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}

:focus-visible {
  outline-color: var(--brand);
}
```

Nota: las líneas `--font-sans`/`--font-mono` y la regla `body { font-family: ... }` quedan igual que antes en este paso — Task 3 las cambia.

- [ ] **Step 2: Verificar que compila y no rompe nada**

Run: `npx tsc --noEmit && npm run build`
Expected: ambos limpios (es CSS puro, no debería haber errores de tipos).

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: tokens de color canvas crema + familia cromatica (claro y oscuro)"
```

---

### Task 3: Tipografía (Bricolage Grotesque + Inter, reemplazo total de Geist)

**Files:**
- Modify: `src/app/layout.tsx` (completo)
- Modify: `src/app/globals.css` (líneas de fuente en `@theme inline` + regla `body`)

**Interfaces:**
- Consumes: nada.
- Produces: utilidades Tailwind `font-sans` (Inter) y `font-display` (Bricolage Grotesque), utilidades de tamaño `text-caption`/`text-body-sm`/`text-body`/`text-card-title`/`text-h2`/`text-h1`/`text-donut`. Tareas 5-9 usan estas clases.

- [ ] **Step 1: Reemplazar las fuentes en `layout.tsx`**

```tsx
import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  weight: ["600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ORDR — decide qué pedir en 10 segundos",
  description: "Sube una foto de la carta. ORDR la lee, calcula macros reales y te dice qué pedir según tu objetivo.",
};

export const viewport: Viewport = {
  themeColor: "#059669",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Actualizar `globals.css` — fuentes + escala tipográfica**

En el bloque `@theme inline`, reemplaza:

```css
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
```

por:

```css
  --font-sans: var(--font-inter);
  --font-display: var(--font-bricolage);

  --text-caption: 0.75rem;
  --text-body-sm: 0.875rem;
  --text-body: 1rem;
  --text-card-title: 1.25rem;
  --text-h2: 1.5rem;
  --text-h1: 2rem;
  --text-donut: 3.5rem;
```

Y en la regla `body`, reemplaza:

```css
  font-family: Arial, Helvetica, sans-serif;
```

por:

```css
  font-family: var(--font-sans), Arial, Helvetica, sans-serif;
```

(Esto también arregla un bug preexistente: `body` nunca aplicaba `--font-geist-sans` — usaba Arial hardcodeado pese a que `next/font` ya cargaba Geist. Con este cambio, Inter sí se aplica de verdad.)

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npm run build`
Expected: ambos limpios. Confirma también con `grep -rn "geist" src/` que no queda ninguna referencia (case-insensitive).

Run: `grep -rin "geist" src/`
Expected: sin resultados.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat: tipografia Bricolage Grotesque + Inter, reemplaza Geist"
```

---

### Task 4: `Ring` — primitivo de anillo SVG compartido

Nuevo componente de presentación puro (sin animación propia) — Task 5 lo anima desde fuera vía el prop `progress`; Task 7 lo usa estático.

**Files:**
- Create: `src/components/features/score-ring.tsx`

**Interfaces:**
- Consumes: tokens de color de Task 2 (los valores de `colorVar` que le pasen sus consumidores, p. ej. `"var(--color-sem-green)"`).
- Produces: `export type RingSegment = { value: number; colorVar: string }` y `export function Ring(props: { segments: RingSegment[]; size: number; strokeWidth: number; total?: number; progress?: number; className?: string })`. Task 5 (hero) y Task 7 (dish card) importan ambos desde `@/components/features/score-ring`.

- [ ] **Step 1: Crear el componente**

```tsx
export type RingSegment = { value: number; colorVar: string };

function polarRotation(startFraction: number) {
  return -90 + startFraction * 360;
}

export function Ring({
  segments,
  size,
  strokeWidth,
  total,
  progress = 1,
  className,
}: {
  segments: RingSegment[];
  size: number;
  strokeWidth: number;
  total?: number;
  progress?: number;
  className?: string;
}) {
  const radius = size / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const effectiveTotal = total ?? segments.reduce((sum, s) => sum + s.value, 0) || 1;

  let accum = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className} aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-line)"
        strokeWidth={strokeWidth}
      />
      {segments.map((seg, i) => {
        const startFraction = accum / effectiveTotal;
        const segFraction = (seg.value / effectiveTotal) * progress;
        accum += seg.value;
        return (
          <circle
            key={i}
            data-ring-segment
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={seg.colorVar}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - segFraction)}
            transform={`rotate(${polarRotation(startFraction)} ${size / 2} ${size / 2})`}
          />
        );
      })}
    </svg>
  );
}
```

Cómo funciona: cada segmento es un círculo completo cuyo `strokeDasharray` es la circunferencia entera; `strokeDashoffset` controla cuánto de ese trazo se ve (técnica estándar de "progress ring" SVG). Cada segmento arranca donde termina el anterior (`rotate` a `startFraction`). `progress` (0-1) escala el relleno de TODOS los segmentos a la vez — así Task 5 anima el llenado con un solo tween sin tocar este archivo.

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: limpio.

- [ ] **Step 3: Commit**

```bash
git add src/components/features/score-ring.tsx
git commit -m "feat: componente Ring - anillo SVG compartido para donut y mini-score"
```

---

### Task 5: Donut del hero + reorden de la página de Resultado

**Files:**
- Modify: `src/components/features/analyze-hero-card.tsx` (completo)
- Modify: `src/components/features/analyze-results.tsx` (completo)

**Interfaces:**
- Consumes: `Ring`/`RingSegment` de Task 4; tokens de color/tipografía de Tasks 2-3.
- Produces: `AnalyzeHeroCard`/`AnalyzeResults` — mismas props que antes, sin cambios de firma.

- [ ] **Step 1: Reescribir `analyze-hero-card.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Ring } from "@/components/features/score-ring";
import type { AnalyzeResponse, Verdict } from "@/schemas";

export function AnalyzeHeroCard({ dishes }: { dishes: AnalyzeResponse["dishes"] }) {
  const counts: Record<Verdict, number> = { green: 0, amber: 0, red: 0 };
  for (const d of dishes) counts[d.verdict]++;
  const [progress, setProgress] = useState(0);

  useGSAP(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setProgress(1);
      return;
    }
    const obj = { p: 0 };
    gsap.to(obj, {
      p: 1,
      duration: 0.6,
      ease: "power2.out",
      onUpdate: () => setProgress(obj.p),
    });
  }, [dishes]);

  return (
    <div
      className="flex flex-col items-center gap-2 rounded-lg border border-line p-6 text-center"
      style={{ backgroundImage: "linear-gradient(135deg, var(--grad-hero-from), var(--grad-hero-to))" }}
    >
      <div className="relative inline-flex items-center justify-center">
        <Ring
          segments={[
            { value: counts.green, colorVar: "var(--color-sem-green)" },
            { value: counts.amber, colorVar: "var(--color-sem-amber)" },
            { value: counts.red, colorVar: "var(--color-sem-red)" },
          ]}
          size={140}
          strokeWidth={12}
          progress={progress}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-donut font-bold leading-none text-ink tabular-nums">
            {counts.green}
          </span>
          <span className="text-caption uppercase tracking-wide text-ink-soft">en verde</span>
        </div>
      </div>
      <p className="text-body-sm text-ink-soft">
        {dishes.length} plato{dishes.length === 1 ? "" : "s"} analizados
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Reordenar `analyze-results.tsx`**

```tsx
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

  useGSAP(
    () => {
      if (filteredDishes.length > 0) {
        gsap.from(".dish-card", {
          opacity: 0,
          y: 16,
          duration: 0.4,
          stagger: 0.06,
          ease: "power2.out",
        });
      }
    },
    { scope: containerRef, dependencies: [result, filter] }
  );

  return (
    <main ref={containerRef} className="mx-auto w-full max-w-2xl space-y-4 px-4 py-10">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-h2 font-semibold text-ink">Resultado</h2>
        <button
          type="button"
          onClick={onReset}
          className="text-body-sm text-ink-soft underline underline-offset-2"
        >
          Analizar otra carta
        </button>
      </div>

      {!result.menuReadOk && (
        <p className="rounded-md bg-sem-red-bg px-3 py-2 text-body-sm text-sem-red">
          No se pudo leer la carta. {result.notes}
        </p>
      )}

      <AnalyzeHeroCard dishes={result.dishes} />
      <VerdictFilterChips dishes={result.dishes} value={filter} onChange={setFilter} />

      {result.menuReadOk && result.notes && (
        <details className="rounded-md border border-line px-3 py-2 text-body-sm">
          <summary className="cursor-pointer text-ink-soft">Sobre esta carta</summary>
          <p className="mt-2 text-ink-soft">{result.notes}</p>
        </details>
      )}

      {filteredDishes.length === 0 ? (
        <p className="rounded-md border border-line px-4 py-6 text-center text-body-sm text-ink-soft">
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

(El error de `!menuReadOk` se queda arriba de todo — es un fallo, no la nota informativa que pide moverse la auditoría. Solo `result.notes` en el camino feliz pasa al `<details>`.)

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: limpio.

- [ ] **Step 4: Manual — probar con reduced motion on/off**

En Chrome DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce", recargar `/analyze` tras un análisis real. Confirmar: con reduce activo el anillo aparece ya lleno (sin animación); sin reduce, se anima 600ms.

- [ ] **Step 5: Commit**

```bash
git add src/components/features/analyze-hero-card.tsx src/components/features/analyze-results.tsx
git commit -m "feat: donut animado en hero + reorden de Resultado (notas a desplegable)"
```

---

### Task 6: Chips de filtro semánticos

**Files:**
- Modify: `src/components/features/verdict-filter-chips.tsx` (completo)

**Interfaces:**
- Consumes: tokens de color de Task 2.
- Produces: sin cambios de firma (`VerdictFilterChips`, `VerdictFilter` igual que antes).

- [ ] **Step 1: Reescribir el componente**

```tsx
import type { AnalyzeResponse, Verdict } from "@/schemas";

export type VerdictFilter = "all" | Verdict;

const FILTER_LABEL: Record<VerdictFilter, string> = {
  all: "Todos",
  green: "Verde",
  amber: "Ámbar",
  red: "Rojo",
};

const FILTERS: VerdictFilter[] = ["all", "green", "amber", "red"];

const CHIP_STYLE: Record<VerdictFilter, { bg: string; text: string }> = {
  all: { bg: "bg-surface-tint", text: "text-ink-soft" },
  green: { bg: "bg-sem-green-bg", text: "text-sem-green" },
  amber: { bg: "bg-sem-amber-bg", text: "text-sem-amber" },
  red: { bg: "bg-sem-red-bg", text: "text-sem-red" },
};

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
      {FILTERS.map((f) => {
        const style = CHIP_STYLE[f];
        return (
          <button
            key={f}
            type="button"
            onClick={() => onChange(f)}
            className={`shrink-0 rounded-full border-2 px-3 py-1 text-caption font-medium transition-colors ${style.bg} ${style.text} ${
              value === f ? "border-current" : "border-transparent"
            }`}
          >
            {FILTER_LABEL[f]} (<span className="font-bold">{counts[f]}</span>)
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: limpio.

- [ ] **Step 3: Commit**

```bash
git add src/components/features/verdict-filter-chips.tsx
git commit -m "feat: chips de filtro con color semantico siempre visible"
```

---

### Task 7: Card de plato — banda semántica, badge, chips de macros, mini-ring

**Files:**
- Modify: `src/components/features/dish-result-card.tsx` (completo)

**Interfaces:**
- Consumes: `Ring`/`RingSegment` de Task 4; tokens de Task 2/3.
- Produces: sin cambios de firma (`DishResultCard`).

- [ ] **Step 1: Reescribir el componente**

```tsx
import type { AnalyzeResponse } from "@/schemas";
import { Ring } from "@/components/features/score-ring";

type Dish = AnalyzeResponse["dishes"][number];

const VERDICT_STYLE: Record<Dish["verdict"], { label: string; text: string; bg: string; band: string; ring: string }> = {
  green: {
    label: "Come esto",
    text: "text-sem-green",
    bg: "bg-sem-green-bg",
    band: "bg-sem-green",
    ring: "var(--color-sem-green)",
  },
  amber: {
    label: "Con matices",
    text: "text-sem-amber",
    bg: "bg-sem-amber-bg",
    band: "bg-sem-amber",
    ring: "var(--color-sem-amber)",
  },
  red: {
    label: "Evita",
    text: "text-sem-red",
    bg: "bg-sem-red-bg",
    band: "bg-sem-red",
    ring: "var(--color-sem-red)",
  },
};

function MacroRow({ label, m }: { label: string; m: { kcal: number; protein_g: number; carbs_g: number; fat_g: number } }) {
  return (
    <p className="text-caption text-ink-soft tabular-nums">
      {label}: {Math.round(m.kcal)} kcal · P {Math.round(m.protein_g)}g · C {Math.round(m.carbs_g)}g · G{" "}
      {Math.round(m.fat_g)}g
    </p>
  );
}

function MacroChips({ m }: { m: { kcal: number; protein_g: number; carbs_g: number; fat_g: number } }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5 text-caption text-ink-soft tabular-nums">
      <span className="rounded-full bg-surface-tint px-2 py-0.5">{Math.round(m.kcal)} kcal</span>
      <span className="rounded-full bg-surface-tint px-2 py-0.5">P {Math.round(m.protein_g)}g</span>
      <span className="rounded-full bg-surface-tint px-2 py-0.5">C {Math.round(m.carbs_g)}g</span>
      <span className="rounded-full bg-surface-tint px-2 py-0.5">G {Math.round(m.fat_g)}g</span>
    </div>
  );
}

export function DishResultCard({ dish }: { dish: Dish }) {
  const style = VERDICT_STYLE[dish.verdict];
  const primaryMacros = dish.groundedMacros ?? dish.approxMacros;

  return (
    <div className="dish-card relative overflow-hidden rounded-lg border border-line bg-surface p-4 pl-5">
      <span className={`absolute inset-y-0 left-0 w-1 ${style.band}`} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Ring segments={[{ value: dish.fitScore, colorVar: style.ring }]} size={28} strokeWidth={3} total={100} />
          <h3 className="font-display text-card-title font-semibold text-ink">{dish.name}</h3>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-caption font-medium ${style.bg} ${style.text}`}>
          {style.label}
        </span>
      </div>
      <p className="mt-1 text-body-sm text-ink-soft">{dish.reason}</p>
      <MacroChips m={primaryMacros} />
      {dish.conflicts.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-caption text-sem-red">
          {dish.conflicts.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}

      <details className="mt-3 text-body-sm">
        <summary className="cursor-pointer text-ink-soft">Detalle</summary>
        <div className="mt-2 space-y-1">
          {dish.assumptions && <p className="text-caption text-ink-soft">Supuesto: {dish.assumptions}</p>}
          <MacroRow label="Estimado (LLM)" m={dish.approxMacros} />
          {dish.groundedMacros ? (
            <MacroRow label={`Fundado (confianza: ${dish.groundedMacros.confidence})`} m={dish.groundedMacros} />
          ) : (
            <p className="text-caption text-ink-soft">
              Fundado: no disponible (API de nutrición falló para este plato, usando estimación del LLM).
            </p>
          )}
        </div>
      </details>
    </div>
  );
}
```

(La banda semántica, el badge y el mini-ring dan la señal a simple vista; los chips de macros muestran siempre el mejor dato disponible — fundado si existe, si no el estimado del LLM. El desplegable "Detalle" conserva el desglose completo estimado-vs-fundado que ya existía, sin quitar información.)

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: limpio.

- [ ] **Step 3: Commit**

```bash
git add src/components/features/dish-result-card.tsx
git commit -m "feat: card de plato con banda semantica, mini-ring y macros siempre visibles"
```

---

### Task 8: Bottom nav — estado activo con icono relleno

**Files:**
- Modify: `src/components/features/bottom-tab-bar.tsx` (completo)

**Interfaces:**
- Consumes: tokens de color de Task 2.
- Produces: sin cambios de firma (`BottomTabBar`).

- [ ] **Step 1: Reescribir el componente**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function AnalyzeIcon({ className, active }: { className?: string; active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path
        d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2M20 8V6a2 2 0 0 0-2-2h-2M20 16v2a2 2 0 0 1-2 2h-2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.5" strokeLinecap="round" strokeLinejoin="round" fill={active ? "currentColor" : "none"} />
    </svg>
  );
}

function ProfileIcon({ className, active }: { className?: string; active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <circle cx="12" cy="8" r="3.2" strokeLinecap="round" strokeLinejoin="round" fill={active ? "currentColor" : "none"} />
      <path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HistoryIcon({ className, active }: { className?: string; active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <circle cx="12" cy="12" r="8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
      {active && <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />}
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
      className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegación principal"
    >
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-caption transition-colors ${
              active ? "font-semibold text-primary-deep" : "font-medium text-ink-soft"
            }`}
          >
            <Icon className="h-5 w-5" active={active} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: limpio.

- [ ] **Step 3: Commit**

```bash
git add src/components/features/bottom-tab-bar.tsx
git commit -m "feat: bottom nav con icono relleno y label en negrita en tab activa"
```

---

### Task 9: Loading stepper (reemplaza el skeleton genérico)

**Files:**
- Modify: `src/components/features/analyze-skeleton.tsx` (completo)

**Interfaces:**
- Consumes: tokens de Task 2/3.
- Produces: sin cambios de firma (`AnalyzeSkeleton()`, sin props, igual que antes — `analyze-client.tsx:167` no necesita tocarse).

- [ ] **Step 1: Reescribir el componente**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

const STEPS = ["Leyendo carta", "Calculando macros", "Rankeando"] as const;
// Avance simulado por tiempo: el análisis real es una sola llamada, sin progreso por
// etapas del backend. Paso 0 activo 0-2s, paso 1 activo 2-4s, paso 2 se queda activo
// hasta que la respuesta real reemplace este componente.
const STEP_ADVANCE_AT_MS = [2000, 4000];

export function AnalyzeSkeleton() {
  const ref = useRef<HTMLElement>(null);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  useEffect(() => {
    const timers = STEP_ADVANCE_AT_MS.map((ms, i) => setTimeout(() => setActiveStep(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <main
      ref={ref}
      tabIndex={-1}
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="mx-auto w-full max-w-2xl space-y-4 px-4 py-10 outline-none"
    >
      <ol className="space-y-3">
        {STEPS.map((label, i) => {
          const done = i < activeStep;
          const active = i === activeStep;
          return (
            <li
              key={label}
              className={`flex items-center gap-3 rounded-lg border border-line px-4 py-3 text-body-sm transition-colors ${
                active ? "bg-surface-tint text-ink" : "text-ink-soft"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-caption font-semibold ${
                  done ? "bg-primary text-white" : active ? "animate-pulse bg-primary/20 text-primary-deep" : "bg-line text-ink-soft"
                }`}
                aria-hidden
              >
                {done ? "✓" : i + 1}
              </span>
              {label}
            </li>
          );
        })}
      </ol>
    </main>
  );
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: limpio.

- [ ] **Step 3: Manual — timing en un análisis real**

En `/analyze`, subir una foto real de carta y observar el stepper durante la espera. Confirmar que el avance (paso 1 a los 2s, paso 2 a los 4s) se siente razonable frente a cuánto tarda la llamada real, y que si la respuesta llega antes de los 4s el stepper no llega a mostrar un estado que luego "retrocede" visualmente (no debería, dado que el componente se desmonta al llegar el resultado).

- [ ] **Step 4: Commit**

```bash
git add src/components/features/analyze-skeleton.tsx
git commit -m "feat: loading stepper narrativo reemplaza skeleton generico"
```

---

## Verificación final (todo el plan)

- [ ] `npx tsc --noEmit` limpio
- [ ] `npm run build` limpio
- [ ] `npx vitest run` limpio (10 tests de `hasHardConflict`/`scoreDish` previos + los del dataset de Task 1, más `targets.test.ts` y `rotate-image-file.test.ts` sin cambios)
- [ ] Manual: claro y oscuro en `/analyze` tras un análisis real — donut, chips, cards, nav, contraste de cada token nuevo
- [ ] Manual: `prefers-reduced-motion` on/off en el donut (Task 5, Step 4)
- [ ] `grep -rin "geist" src/` sin resultados

## Self-Review

**1. Cobertura del spec:** los 8 ítems de la tanda Quick Wins del spec (`docs/superpowers/specs/2026-07-29-quick-wins-redesign-design.md`) están cada uno en una tarea: scoring→Task 1, tokens de color→Task 2, tipografía→Task 3, donut→Task 5, reorden→Task 5, chips→Task 6, card de plato→Task 7, bottom nav→Task 8, stepper→Task 9. Task 4 (`Ring`) es infraestructura compartida que el propio spec pedía ("reutiliza la lógica del anillo del hero a escala menor") — no es un ítem nuevo fuera de alcance.

**2. Placeholders:** ninguno salvo los explícitamente justificados en Task 1 (Steps 1-2, dependientes de datos reales que el usuario aporta durante la ejecución — ya señalado como dependencia externa en el spec aprobado). Todo el resto tiene código completo, valores exactos y comandos concretos.

**3. Consistencia de tipos:** `RingSegment`/`Ring` (Task 4) se consumen igual en Task 5 (`segments` con 3 elementos, `progress` animado) y Task 7 (`segments` con 1 elemento, `total={100}`, `progress` por defecto 1) — misma firma en ambos sitios. Los nombres de token CSS (`--color-sem-green`, `bg-sem-green-bg`, `text-sem-green`, etc.) son idénticos entre Task 2 (donde se definen) y Tasks 5-9 (donde se consumen).
