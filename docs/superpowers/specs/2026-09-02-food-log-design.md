# Diseño — Registro de comidas (marcar plato comido + resumen semanal/mensual)

**Estado:** Aprobado por el usuario (2026-09-02).
**Tipo:** Feature de producto — nueva subsistema (tabla `dishes.eaten_at`, endpoint de escritura, página `/log`). Toca schema, `dish-row.ts`, `route.ts` de `/api/analyze`, `DishResultCard`, bottom nav.

## 1. Contexto y motivación

Hoy `/analyze` produce un veredicto por plato pero no se registra cuál se comió realmente. El usuario quiere: (1) marcar qué plato eligió justo después de analizar, (2) verlo reflejado en `/history` (el propio pedido original: "que en el historial aparezcan las cartas y los platos seleccionados"), y (3) un resumen agregado semanal/mensual de kcal/proteína/carbos/grasa comparado contra su objetivo diario.

## 2. Decisiones (vía brainstorming, confirmadas por el usuario)

| Decisión | Elegido | Alternativa descartada y por qué |
|---|---|---|
| Dónde se marca | En resultados, justo tras analizar (`DishResultCard` en `/analyze`) | Marcar después desde `/history`: más flexible pero paso extra; se descarta por simplicidad v1. |
| Cuántos platos por análisis | Uno solo | Varios (checkbox): complica el cálculo de macros totales por comida sin caso de uso claro pedido. |
| Fuente de macros al loguear | `groundedMacros ?? approxMacros` (mismo fallback que ya usa `route.ts` para el veredicto) | Siempre approx: ignora la fuente más precisa cuando está disponible. |
| Fecha de agrupación en el resumen | Fecha de `eaten_at` (momento de marcar) | Fecha de `analyses.created_at`: en la práctica idéntico dado que solo se marca en el momento del análisis, pero `eaten_at` es semánticamente correcto si algún día se permite marcar más tarde. |
| Carbos/grasa en el resumen | Solo informativos (total acumulado, sin barra de progreso) | Derivar un target repartiendo kcal restantes: regla de negocio nueva no pedida por el PRD, se descarta (YAGNI). |
| Formato del resumen | Tabla por día + barra de progreso (kcal/proteína) | Gráfico de barras: requiere librería de charts o SVG custom, más superficie de bugs sin necesidad clara en v1. |
| Ubicación del resumen | Página nueva `/log`, 4º tab en bottom nav | Sección dentro de `/history`: mezclaría "lista de análisis" con "vista agregada", dos propósitos distintos. |

## 3. Arquitectura

### 3.1 Base de datos

Nueva migración `supabase/migrations/20260902000001_add_dish_eaten_at.sql` (no se edita ninguna migración ya aplicada):
```sql
alter table dishes add column eaten_at timestamptz;

-- Fuerza "solo un plato comido por análisis" también a nivel DB, no solo en la UI.
create unique index dishes_one_eaten_per_analysis
  on dishes (analysis_id)
  where eaten_at is not null;
```
RLS ya cubre `dishes` vía la policy existente (join a `analyses.user_id`) — no hace falta política nueva.

### 3.2 Schema (`src/schemas/index.ts`)

`AnalyzedDishSchema` gana dos campos — necesarios para que el cliente pueda referenciar el dish al marcarlo (hoy el response de `/api/analyze` no expone el id de la fila insertada):
```ts
id: z.string().nullable(),       // null si no está persistido (modo anónimo, D1)
eatenAt: z.string().nullable(),  // ISO timestamp o null
```

### 3.3 Orquestación (`src/app/api/analyze/route.ts`)

`persistIfAuthenticated` cambia el insert de `dishes` para capturar los ids generados:
```ts
const { data: insertedDishes, error: dishesError } = await supabase
  .from("dishes")
  .insert(/* ...igual que hoy... */)
  .select("id");
```
El array de ids (en el mismo orden que `input.dishes`, que ya se insertan ordenados por `rank: i`) se devuelve junto al `analysisId` para que la respuesta final pueda mapear `id` por dish. En modo anónimo (`persistIfAuthenticated` devuelve `null` temprano) todos los dishes llevan `id: null`, `eatenAt: null`.

### 3.4 `src/lib/supabase/dish-row.ts`

`DishRow`, `DISH_ROW_SELECT` y `rowToDish` ganan `id` y `eaten_at` (mismo patrón snake_case ↔ camelCase que el resto del archivo).

### 3.5 Endpoint de escritura — `src/app/api/dishes/[id]/route.ts` (nuevo)

`PATCH /api/dishes/[id]`, body vacío. Toggle:
- Si `eaten_at` es `null` → lo pone a `now()`.
- Si ya tiene valor → lo pone a `null` (deshacer).

Auth-only (igual patrón que `route.ts` de `/api/analyze`: `createClient()` server, `supabase.auth.getUser()`; sin user → 401). La query de update no necesita `.eq("user_id", ...)` explícito porque `dishes` no tiene esa columna — RLS la resuelve vía el join a `analyses`; un intento de marcar un dish ajeno devuelve 0 filas afectadas (`.select().maybeSingle()` → `null` → 404).

El índice único parcial (3.1) hace que, si ya hay un plato marcado en ese `analysis_id`, el INSERT... no aplica aquí (es UPDATE de una fila existente) — el índice solo bloquea un segundo `UPDATE` que intente poner `eaten_at` no-null en OTRA fila del mismo análisis mientras la primera sigue marcada. La UI (3.6) ya solo deja un botón activo a la vez, pero el índice es la garantía real a nivel de datos.

### 3.6 UI — `DishResultCard` (`src/components/features/dish-result-card.tsx`)

Gana dos props opcionales: `onToggleEaten?: (dishId: string) => void` y muestra estado a partir de `dish.eatenAt`:
- Si `onToggleEaten` está presente y `dish.id` no es `null`: botón "Comí esto" ↔ "Comido ✓" (toggle), en ambos sentidos.
- Si `onToggleEaten` NO está presente (anónimo): sin cambio visual respecto a hoy.

`/history/[id]` SÍ pasa `onToggleEaten` (ver 3.8) — permite deshacer una marca equivocada sin volver a `/analyze`, pero no permite marcar un plato nuevo como comido si ninguno lo estaba: el botón solo aparece en el dish que ya tiene `eatenAt` (para desmarcar). Esto respeta la decisión "solo se elige en el momento del análisis" (no se puede decidir a posteriori qué comiste) sin dejar sin salida un marcado por error.

### 3.7 UI — `AnalyzeResults` / `AnalyzeClient`

`AnalyzeResults` recibe la función que llama a `PATCH /api/dishes/[id]` y actualiza el estado local (`result.dishes[i].eatenAt`) de forma optimista, revirtiendo si el PATCH falla (mismo patrón de manejo de error que ya usa `handleSubmit` en `AnalyzeClient`: `setErrorMsg`). Botón deshabilitado mientras la petición está en vuelo, para evitar doble-click.

### 3.8 UI — `/history/[id]` (`src/app/(app)/history/[id]/page.tsx`)

`DISH_ROW_SELECT` ya trae `id` y `eaten_at` (3.4) → `rowToDish` ya lo mapea → `DishResultCard` recibe `onToggleEaten` apuntando al mismo `PATCH /api/dishes/[id]` (3.5), solo renderizado en el dish que ya tiene `eatenAt` (permite desmarcar, ver 3.6). El "aparezca en el historial" pedido por el usuario queda cubierto por el mismo componente compartido.

### 3.9 `targets()` (`src/lib/nutrition/targets.ts`)

Se extiende el `return` (el cálculo interno ya existe, solo faltan exponer los valores diarios):
```ts
return {
  tdee,
  dailyKcal,
  dailyProtein,
  mealKcal: Math.round(dailyKcal / p.mealsPerDay),
  mealProtein: Math.round(dailyProtein / p.mealsPerDay),
};
```
Sin cambio de comportamiento para los consumidores actuales (`mealKcal`/`mealProtein` idénticos); los dos campos nuevos son aditivos.

### 3.10 Agregación — `src/lib/log/aggregate.ts` (nuevo, función pura)

```ts
export type LoggedDish = {
  eatenAt: string; // ISO
  macros: { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
};

export type DayTotals = {
  date: string; // YYYY-MM-DD
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export function aggregateByDay(dishes: LoggedDish[]): DayTotals[]
```
Agrupa por fecha local (`YYYY-MM-DD` del `eatenAt`), suma macros, ordena descendente por fecha. Sin dependencia de Supabase/Next — testeable en aislamiento con Vitest (mismo patrón que `scoring.ts`/`targets.ts`).

### 3.11 Página nueva `/log` (`src/app/(app)/log/page.tsx`)

Server component, mismo patrón que `/history` (consulta Supabase directo, sin API route nueva para lectura):
```ts
const { data } = await supabase
  .from("dishes")
  .select("eaten_at, grounded_macros, approx_macros")
  .not("eaten_at", "is", null)
  .gte("eaten_at", rangeStart.toISOString());
```
`rangeStart` = hoy-7 días (semana, default) o hoy-30 días (mes), según query param `?range=week|month`. RLS restringe a los propios dishes del usuario vía join a `analyses` — no hace falta `.eq` adicional (mismo razonamiento que 3.5).

Cada fila se mapea a `LoggedDish` (`macros = grounded_macros ?? approx_macros`) → `aggregateByDay()` → tabla: una fila por día con kcal/proteína (barra de progreso vs `targets(profile).dailyKcal`/`dailyProtein`, perfil resuelto igual que ya hace `/analyze` para usuario autenticado) + carbos/grasa (número plano, sin barra). Toggle semana/mes como dos tabs/links simples (`?range=week` / `?range=month`), sin estado cliente.

Si el usuario no tiene perfil guardado (caso raro para alguien autenticado con historial): la página muestra los totales sin barra de progreso, con nota "completa tu perfil para ver progreso vs objetivo".

### 3.12 Bottom nav (`src/components/features/bottom-tab-bar.tsx`)

`TABS` gana una 4ª entrada `{ href: "/log", label: "Registro", Icon: LogIcon }`, mismo patrón SVG que los iconos existentes (icono simple, ej. lista con check).

## 4. Flujo de datos

```
/analyze → POST /api/analyze → persistIfAuthenticated inserta dishes,
  captura ids → AnalyzeResponseSchema (dishes con id + eatenAt:null) →
  DishResultCard con botón "Comí esto" → PATCH /api/dishes/[id] →
  eaten_at = now() en DB

/history/[id] → DISH_ROW_SELECT trae eaten_at → DishResultCard
  muestra badge de solo lectura si está marcado

/log?range=week|month → SELECT dishes con eaten_at en rango →
  aggregateByDay() → tabla por día vs targets(profile)
```

## 5. Manejo de errores

- `PATCH /api/dishes/[id]` sin sesión → 401. Dish ajeno o inexistente → 404 (RLS produce 0 filas, no se distingue "no existe" de "no es tuyo", igual que el resto de la app).
- Modo anónimo: `DishResultCard` nunca recibe `onToggleEaten` (AnalyzeClient solo lo pasa si `isAuthenticated`) — ningún botón se renderiza, consistente con D1 (anónimo no persiste nada).
- `/log` sin ningún dish marcado en el rango: tabla vacía con mensaje "Aún no has marcado ningún plato como comido — hazlo desde los resultados de un análisis."
- Fallo del PATCH (red/servidor): revertir el estado optimista del botón, mostrar error igual que `handleSubmit` hoy.

## 6. Testing

- `aggregateByDay` (función pura): test unitario nuevo `src/lib/log/aggregate.test.ts` — casos: varios dishes mismo día se suman, dishes de días distintos no se mezclan, orden descendente por fecha, array vacío → `[]`.
- `targets()`: extender `targets.test.ts` existente para cubrir que `dailyKcal`/`dailyProtein` aparecen y son consistentes con `mealKcal * mealsPerDay` (redondeo aparte).
- `PATCH /api/dishes/[id]`: test de route handler nuevo (`src/app/api/dishes/[id]/route.test.ts`), mismo patrón mockeado que `src/app/api/analyze/route.test.ts` — casos: sin sesión → 401, toggle marca y desmarca.
- `npx tsc --noEmit`, `npm run lint`, `npx vitest run` limpios.
- Verificación manual (Playwright, mismo patrón que Sprint 4): analizar carta real autenticado → marcar un plato → confirmar botón cambia a "Comido ✓" → entrar a `/history/[id]` → confirmar badge visible → entrar a `/log` → confirmar el plato aparece en el día de hoy con macros correctas y barra de progreso.
- Migración aplicada manualmente por el usuario en Supabase real antes de probar (mismo flujo que Sprint 1/Sprint 4).

## 7. Fuera de alcance (explícito)

- Elegir/marcar un plato nuevo como comido desde `/history` (solo se decide en el momento del análisis, v1) — desde `/history` solo se puede desmarcar el que ya estaba marcado.
- Múltiples platos comidos por análisis.
- Target diario de carbos/grasa (solo informativo en v1).
- Gráfico de barras / librería de charts.
- Edición manual de macros de un dish ya marcado (ej. "comí solo la mitad").
- Vista/acción de deshacer directamente desde `/log` (para desmarcar, se entra a `/history/[id]` del día correspondiente).
