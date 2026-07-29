# Design — ORDR Quick Wins (scoring fix + rediseño visual base)

## Contexto

Auditoría de usuario en `C:\Users\xtrem\Downloads\AUDITORIA_ORDR.md` (2026-07-29) identifica 3 problemas: fondo negro puro sin canvas cálido, un solo verde de acento sin familia cromática, y layout mobile-first flotando en desktop. Además marca un bug funcional crítico fuera de lo visual: el motor de scoring satura casi todos los platos a 80 puntos, sin discriminar.

La auditoría propone un roadmap en 3 tandas (Quick wins / Medio plazo / Apuesta grande). Este spec cubre **solo la tanda Quick wins** — el resto (card "Tu elección" destacada, tags+iconos con migración, historial, perfil, layout desktop 2 col, empty/error states, onboarding, porción en vivo, compartir, favoritos) queda fuera y se especificará por separado más adelante.

Contexto de código relevante ya mergeado en `master` (branches `nutrition-filters` y `analyze-mobile-ux`, ambos integrados hoy): `analyze-hero-card.tsx`, `verdict-filter-chips.tsx`, `bottom-tab-bar.tsx`, `analyze-skeleton.tsx` ya existen — este spec los **restilea/extiende**, no los reconstruye desde cero.

## Alcance (Quick wins, 8 ítems)

1. Fix del motor de scoring (bug) + tests de regresión
2. Tokens de color: canvas crema claro + variante oscura adaptada, OKLCH vía `@theme`
3. Tipografía: Bricolage Grotesque (display) + Inter (UI/body), reemplazo total de Geist
4. Donut/resumen del hero (`analyze-hero-card.tsx`)
5. Reorden de la página de Resultado (donut+hero primero, notas del LLM a un desplegable)
6. Chips/badges semánticos (`verdict-filter-chips.tsx` + cards de plato en la lista)
7. Bottom nav — estado activo (`bottom-tab-bar.tsx`)
8. Loading stepper — reemplaza el skeleton genérico (`analyze-skeleton.tsx`)

**Excluido de este spec** (tandas posteriores): card "Tu elección" destacada, tags de plato + iconos de categoría (requiere migración `dishes.tags`), historial con nombre de restaurante, perfil agrupado + hero TDEE, layout desktop 2 columnas, empty/error states, onboarding 3 pantallas, ajuste de porción en vivo, compartir como imagen, favoritos.

Sin cambios de esquema de datos en este spec — es 100% código/CSS/componentes.

## 1. Fix del motor de scoring (bug)

`src/lib/nutrition/scoring.ts:8-41` — `scoreDish` calcula una suma ponderada de términos `clamp()`'d por objetivo (cut/bulk/maintain), con veredicto cortado en 70/45. Síntoma reportado (casi todo puntúa 80): los términos individuales `clamp()` saturan a 1 para la mayoría de platos reales — p. ej. `clamp(proteinPct / 0.4)` llega a 1 con cualquier plato ≥40% kcal-proteína, algo común, así que el score deja de discriminar a partir de ahí.

**Enfoque:** recalibrar las constantes de la fórmula contra un dataset de 15-20 platos reales etiquetados a mano (nombre + macros + objetivo + veredicto/rango esperado que el usuario aporta) — no adivinar constantes nuevas sin casos reales de referencia. Esto es un problema con forma de debugging sistemático más que de diseño puro: la sesión de implementación que ataque esta tarea debe invocar `systematic-debugging`.

`scoring.test.ts` gana los 15-20 casos del dataset como tests de regresión permanentes (ya tiene 10 tests de `hasHardConflict`/`scoreDish` de la feature de filtros nutricionales — estos se suman, no se reemplazan). Al menos un caso explícito por la auditoría: "plato muy graso en cut debe puntuar <45".

**Este es el ítem bloqueante de la tanda** — el resto del rediseño visual no depende de él técnicamente, pero decorar un score que no discrimina no tiene sentido de producto. Se ejecuta primero.

**Dependencia externa:** el dataset de 15-20 platos lo aporta el usuario durante la ejecución del plan (no está disponible en este momento de brainstorming). La tarea correspondiente en el plan de implementación debe pausar y pedirlo explícitamente si no ha llegado aún.

## 2. Tokens de color (OKLCH vía `@theme`, Tailwind v4)

Se mantiene soporte a dark mode (`prefers-color-scheme: dark`), con variante oscura de los tokens nuevos — no se elimina el bloque dark existente en `globals.css:36-45`.

### Claro (de la auditoría, directo)

| Token | Hex |
|---|---|
| `canvas` | `#F7F4EC` |
| `surface` | `#FFFFFF` |
| `surface-tint` | `#EFF3EA` |
| `ink` | `#1E2620` |
| `ink-soft` | `#5C665E` |
| `line` | `#E2DFD3` |
| `primary` | `#22A45D` |
| `primary-deep` | `#166B3D` |
| `accent-sun` | `#F2C94C` |
| `sem-green` / bg | `#22A45D` / `#E3F3E9` |
| `sem-amber` / bg | `#D9911F` / `#FBF0D9` |
| `sem-red` / bg | `#D14B3C` / `#F9E4E0` |
| `grad-hero` | `#DCEFE2 → #F7F4EC` |

### Oscuro (nuevo, adaptado — no existía en la auditoría)

Las backgrounds pálidas de los chips semánticos no funcionan sobre fondo oscuro (parche blanco brillante); en dark se invierten a fondo oscuro-teñido + texto claro, siguiendo el patrón que ya usa el proyecto para `brand`/`accent` (`globals.css:36-45`).

| Token | Hex |
|---|---|
| `canvas-dark` | `#14181A` |
| `surface-dark` | `#1C221D` |
| `surface-tint-dark` | `#232B24` |
| `ink-dark` | `#F4F1E8` |
| `ink-soft-dark` | `#A9B3A6` |
| `line-dark` | `#2E362F` |
| `primary-dark` | `#34D399` |
| `primary-deep-dark` | `#4ADE80` |
| `accent-sun-dark` | `#F2C94C` (sin cambio) |
| `sem-green-dark` / bg | `#4ADE80` / `#123321` |
| `sem-amber-dark` / bg | `#F5A623` / `#332405` |
| `sem-red-dark` / bg | `#F87171` / `#3B1512` |
| `grad-hero-dark` | `#16241C → #14181A` |

Regla de la auditoría preservada: el semáforo (verdict rojo/ámbar/verde) es el único sitio donde conviven los 3 semánticos; el resto de la UI vive en verde+crema+sol.

Implementación: valores hex de referencia arriba, convertidos a `oklch()` en `globals.css` dentro de `:root` / `@theme inline` / el bloque `@media (prefers-color-scheme: dark)`, mismo patrón que los tokens `--brand-*` actuales. Todo par texto/fondo nuevo se verifica WCAG AA (4.5:1 texto normal, 3:1 texto grande) igual que están documentados los actuales en el comentario de cabecera de `globals.css`.

## 3. Tipografía

`next/font/google`: `Bricolage_Grotesque` (weights 600/700, expuesta como `--font-display`) + `Inter` (weights 400/500/600, expuesta como `--font-sans`). Reemplaza por completo `Geist`/`Geist_Mono` en `src/app/layout.tsx` y las referencias `--font-geist-sans`/`--font-geist-mono` en `globals.css:29-30`.

Uso: Bricolage para h1/h2/número del donut/nombres de plato; Inter para todo lo demás. Campos numéricos (scores, macros, kcal) llevan `font-feature-settings: "tnum"` vía una utilidad `.tabular-nums` (Inter tnum cubre lo que antes hacía Geist Mono — no se conserva ninguna mono).

Escala: `12` caption/label (uppercase + tracking) · `14` body-sm · `16` body · `20` título de card · `24` h2 · `32` h1 · `56` número del donut.

## 4. Restyle de componentes existentes

- **`analyze-hero-card.tsx`** (33 líneas): anillo (donut) con los 3 semánticos, número grande centrado (Bricolage 56), animación de llenado 600ms (GSAP), gate en `prefers-reduced-motion`.
- **Página de Resultado / `analyze-results.tsx`**: reorden — donut+hero primero, luego lista de platos; las notas del LLM pasan a un `<details>` "Sobre esta carta".
- **`verdict-filter-chips.tsx`** (48 líneas): fondo del chip = bg semántico suave del veredicto correspondiente, conteo en negrita, "Todos" queda neutro.
- **Cards de plato en la lista**: banda izquierda 4px del color semántico, badge pill relleno, chips de macros (kcal · P · C · G) siempre visibles (sin esconder tras "Detalle"), mini-anillo de score 28px (reutiliza la lógica del anillo del hero a escala menor).
- **`bottom-tab-bar.tsx`** (69 líneas): icono relleno (filled) + label en 600 en la tab activa (hoy solo cambia color, apenas se percibe).
- **`analyze-skeleton.tsx`** (36 líneas) → reconstruido como stepper: 3 estados narrativos ("Leyendo carta" → "Calculando macros" → "Rankeando"). Como el análisis es una sola llamada (no hay progreso real por etapas de backend), el avance se **simula por tiempo** client-side: ~0-2s paso 1, ~2-4s paso 2, 4s+ paso 3 (se queda ahí hasta que llegue la respuesta real). Se mantiene `role="status"` / `aria-live="polite"` / `aria-busy="true"` del componente actual.

## 5. Verificación

- `npx tsc --noEmit`, `npm run build`, `npx vitest run` limpios al final.
- `scoring.test.ts`: los 15-20 casos del dataset del usuario deben pasar — este es el criterio real de "fix aceptado", no solo que los tests existentes sigan en verde.
- Manual: `prefers-reduced-motion` on/off en la animación del donut; claro y oscuro para cada token nuevo; timing del stepper se siente razonable en un análisis real; contraste WCAG AA verificado en cada par texto/fondo semántico nuevo (incluyendo los de dark).
- Sin migración de base de datos, sin cambio de esquema — esta tanda es 100% código/CSS/componentes.

## Self-Review

- Sin placeholders: cada ítem tiene archivo(s) concreto(s) y valores exactos (hex, pesos de fuente, tamaños de escala, timings).
- Consistencia interna: dark mode se mantiene (decisión explícita del usuario) y su paleta deriva del mismo criterio que la clara; ningún ítem de "Medio plazo"/"Apuesta grande" se coló en el alcance.
- Alcance: 8 ítems, un solo spec, sin necesidad de descomponer más — es la tanda que la propia auditoría ya delimitó.
- Ambigüedad resuelta: el stepper de carga usa avance simulado por tiempo (no progreso real, decisión explícita); el dataset de scoring lo aporta el usuario (no sintético, decisión explícita); reemplazo total de Geist por Bricolage+Inter (no convivencia, decisión explícita).
