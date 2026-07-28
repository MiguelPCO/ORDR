# Diseño — Filtros nutricionales (alergias extra, no-me-gusta, límites de grasa/carbos)

**Estado:** Aprobado por el usuario (2026-07-28).
**Tipo:** Feature de producto — toca schema, motor de scoring, prompt del LLM y base de datos. Independiente de la rama `analyze-mobile-ux` (que es solo UI); se construye directo sobre `master`.

## 1. Contexto y motivación

El perfil hoy (`ProfileSchema` en `src/schemas/index.ts`) solo modela `diet` (none/vegan/vegetarian/keto) y `allergies` (texto libre) como guardarraíles duros. El usuario quiere poder excluir ingredientes que simplemente no le gustan (sin ser alergia) y poner límites numéricos de grasa/carbohidratos por comida — hoy el único límite de este tipo es un valor hardcodeado (`carbs_g > 20` para `diet === "keto"`) en `hasHardConflict` (`src/lib/nutrition/scoring.ts`).

## 2. Decisiones (via brainstorming, confirmadas por el usuario)

| Decisión | Elegido | Alternativa descartada y por qué |
|---|---|---|
| Dónde viven los filtros | Perfil como default (persistente) + ajustable por sesión en `/analyze` | Solo perfil: no permite un ajuste puntual para una carta concreta. Solo sesión: obliga a repetir la configuración cada vez. |
| Trato de "no me gusta" en el motor | Guardarraíl duro — mismo tratamiento que alergia/dieta: `red` siempre, `fit_score = 0` | Penalización suave (restar puntos sin forzar rojo): más flexible pero más trabajo de calibración: el usuario prefirió la simplicidad de reusar el guardarraíl que ya existe. |
| Límites de grasa/carbos: nivel | Gramos **por comida**, campo numérico opcional (vacío = sin límite) | Gramos por día repartidos entre comidas: consistente con el reparto diario que ya existe para kcal/proteína, pero un paso de cálculo extra que el usuario no pidió. |
| Alcance de límites en v1 | Solo grasa + carbohidratos | Sodio/azúcar también: YAGNI, se añaden después con el mismo patrón si hace falta. |
| Ajuste por sesión: reemplazo vs suma | Alergias/no-me-gusta de sesión se **suman** a las del perfil (nunca las reemplazan); límites de grasa/carbos de sesión **sobrescriben** el default del perfil solo para esa sesión | Reemplazar alergias por sesión sería peligroso (podría desactivar sin querer una protección real). |
| UI en `/analyze` | Sección colapsable "Más filtros" junto al selector de objetivo, oculta por defecto | Siempre visible: más rápido de usar pero infla la pantalla principal en cada análisis. |

## 3. Arquitectura

### 3.1 Schema (`src/schemas/index.ts`)

`ProfileSchema` gana tres campos:
```ts
dislikes: z.array(z.string()).default([]),
fatLimitG: z.number().positive().nullable().default(null),
carbLimitG: z.number().positive().nullable().default(null),
```

`AnalyzeRequestSchema.profileSnapshot` gana los mismos tres campos (más `dislikesExtra`, ver 3.4) para que fluyan desde el cliente hasta `/api/analyze`.

### 3.2 Prompt del LLM (`src/lib/llm/read-menu.ts`)

`ReadMenuProfile` gana `dislikes: string[]`. `buildUserText` los incluye junto a dieta/alergias. El `SYSTEM_PROMPT` (punto 7, sobre `conflicts`) se actualiza para pedir explícitamente que declare en `conflicts` cualquier ingrediente de la lista "no me gusta", igual que ya hace con alérgenos — mismo mecanismo, una fuente más de verdad para el array que ya se genera.

### 3.3 Motor de scoring (`src/lib/nutrition/scoring.ts`)

`hasHardConflict` gana dos parámetros opcionales:
```ts
export function hasHardConflict(
  conflicts: string[],
  grounded: Macros | null,
  diet: Diet,
  fatLimitG: number | null = null,
  carbLimitG: number | null = null
): boolean {
  if (conflicts.length > 0) return true;
  const effectiveCarbLimit = carbLimitG ?? (diet === "keto" ? KETO_CARB_LIMIT_G : null);
  if (grounded && effectiveCarbLimit !== null && grounded.carbs_g > effectiveCarbLimit) return true;
  if (grounded && fatLimitG !== null && grounded.fat_g > fatLimitG) return true;
  return false;
}
```
El chequeo hardcodeado de keto (20g) pasa a ser el *default* de `carbLimitG` cuando la dieta es keto y no hay un límite explícito del usuario — comportamiento existente preservado, no una regresión.

### 3.4 Orquestación (`src/app/api/analyze/route.ts`)

- `readMenu` recibe `dislikes: [...profileSnapshot.dislikes, ...profileSnapshot.dislikesExtra]` (unión perfil + sesión) además de `diet`/`allergies` (que ya se unen igual: `[...profileSnapshot.allergies, ...profileSnapshot.allergiesExtra]`).
- `hasHardConflict` recibe `profileSnapshot.fatLimitG` / `profileSnapshot.carbLimitG` (ya resueltos por el cliente: si el usuario ajustó el límite en la sesión, el cliente manda ese valor; si no, manda el default del perfil).

### 3.5 Base de datos

Nueva migración `supabase/migrations/20260729000001_add_profile_filters.sql` (no se edita ninguna migración ya aplicada):
```sql
alter table profiles
  add column dislikes text[] not null default '{}',
  add column fat_limit_g numeric,
  add column carb_limit_g numeric;
```
`src/lib/supabase/profile-row.ts`: `ProfileRow`, `PROFILE_ROW_SELECT` y `rowToProfile` actualizados para las tres columnas nuevas (snake_case ↔ camelCase, mismo patrón que el resto del archivo).

### 3.6 UI — Perfil (`src/components/features/profile-form.tsx`)

Tres campos nuevos, mismo patrón visual que los existentes: `dislikes` como input de texto separado por comas (igual que `allergies`), `fatLimitG`/`carbLimitG` como inputs numéricos opcionales (`placeholder="sin límite"`, igual que `manualTdee` ya hace con TDEE). `saveProfile` (server action) mapea los tres campos nuevos a las columnas snake_case.

### 3.7 UI — Sesión (`src/components/features/analyze-client.tsx`)

Sección colapsable "Más filtros" (un `<details>` o botón-toggle, colapsada por defecto) junto al selector de "Objetivo de esta sesión", con:
- Campo de texto "Alergias/no me gusta extra para esta carta" (separado por comas) → se envía como `allergiesExtra`/`dislikesExtra` (arrays separados, ya que alergia y no-me-gusta llevan razones distintas mostradas al usuario, aunque el motor las trate igual).
- Dos campos numéricos "Límite de grasa (g)" / "Límite de carbos (g)", precargados con `profile.fatLimitG`/`profile.carbLimitG`, editables solo para esta sesión (no escriben de vuelta al perfil).

Estado nuevo en `AnalyzeClient`: `sessionAllergiesExtra`, `sessionDislikesExtra` (arrays), `sessionFatLimitG`, `sessionCarbLimitG` (inicializados desde `profile.fatLimitG`/`profile.carbLimitG`, editables). El payload de `handleSubmit` incluye estos cuatro campos junto a los que ya existen.

## 4. Flujo de datos

```
Perfil (defaults) ──> /analyze carga defaults en "Más filtros" ──>
  usuario ajusta (opcional, solo esta sesión) ──> payload a /api/analyze ──>
  readMenu(dislikes unidos) ──> groundMacrosBatch (sin cambios) ──>
  hasHardConflict(conflicts, grounded, diet, fatLimitG, carbLimitG) ──> scoreDish (sin cambios)
```
Sin cambios en `groundMacrosBatch`/`scoreDish` en sí — los nuevos límites entran únicamente como guardarraíl previo a `scoreDish`, igual que hoy hace el chequeo de keto.

## 5. Manejo de errores

- Campos numéricos vacíos → `null` (sin límite), no `0` ni `NaN` — mismo patrón que `manualTdee` ya usa en `ProfileForm`.
- `dislikes`/`allergiesExtra` vacíos → arrays vacíos, no rompen la unión con los del perfil.
- Si `fatLimitG`/`carbLimitG` del perfil es `null` y la sesión no lo ajusta, el campo de sesión queda vacío (sin límite) — comportamiento actual preservado por defecto.

## 6. Testing

- `hasHardConflict` es una función pura (no depende de Canvas ni red, a diferencia de `rotateImageFile`) — se le añade un test unitario real en `src/lib/nutrition/scoring.test.ts` (nuevo archivo, mismo patrón que `targets.test.ts`), con casos: `fatLimitG` superado → `true`; `carbLimitG` explícito distinto de 20 anula el default de keto; dieta keto sin `carbLimitG` explícito sigue usando 20g como antes.
- `npx tsc --noEmit`, `npm run build`, `npx vitest run` limpios.
- Verificación manual: guardar perfil con los 3 campos nuevos, confirmar que persisten tras recargar; en `/analyze`, expandir "Más filtros", ajustar un límite, analizar una carta real y confirmar que un plato que supera el límite sale rojo con `fit_score = 0`.

## 7. Fuera de alcance (explícito)

- Límites de sodio/azúcar (v2 si hace falta, mismo patrón).
- Penalización suave en vez de guardarraíl duro para "no me gusta".
- Reemplazar (en vez de sumar) alergias por sesión.
- Cualquier cambio a la rama `analyze-mobile-ux` (UI móvil) — este spec es independiente y se construye sobre `master`.
