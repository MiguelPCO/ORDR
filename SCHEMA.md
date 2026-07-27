# SCHEMA — ORDR

Contratos de datos, tipos y API. Depende de las decisiones D1–D4 del PRD (todas cerradas): auth + perfil persistente + historial, TDEE calculado, **API Ninjas** (sustituye a Nutritionix tras el cierre de su acceso self-serve, jul 2026).

---

## 1. Modelo de datos (Supabase / Postgres)

### `profiles` (1:1 con `auth.users`)
| columna | tipo | notas |
|---|---|---|
| `id` | uuid PK | = `auth.uid()` |
| `display_name` | text | |
| `sex` | text | `'male' \| 'female'` (para BMR) |
| `birth_date` | date | edad derivada |
| `height_cm` | numeric | |
| `weight_kg` | numeric | |
| `activity_level` | text | `'sedentary'\|'light'\|'moderate'\|'active'\|'very_active'` |
| `diet` | text | `'none'\|'vegan'\|'vegetarian'\|'keto'` |
| `allergies` | text[] | términos libres normalizados |
| `goal` | text | `'cut'\|'bulk'\|'maintain'` (objetivo por defecto) |
| `meals_per_day` | int | default 3 |
| `protein_g_per_kg` | numeric | default 2.0 |
| `manual_tdee` | int | nullable (override) |
| `created_at` / `updated_at` | timestamptz | |

> BMR/TDEE/targets **no se guardan**: se derivan en app (ver §6). Evita datos desincronizados.

### `analyses` (una sesión = una carta analizada)
| columna | tipo | notas |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK→profiles | nullable (anónimo = sin fila) |
| `goal_snapshot` | jsonb | **copia** del perfil+target al momento del análisis |
| `source_type` | text | `'image'\|'pdf'\|'url'` |
| `source_meta` | jsonb | nombres de archivo / url |
| `status` | text | `'processing'\|'done'\|'error'` |
| `notes` | text | nota global del LLM |
| `created_at` | timestamptz | |

> `goal_snapshot` es clave: si el usuario cambia de peso u objetivo, los análisis viejos **no** deben recalcularse. Inmutabilidad histórica.

### `dishes` (resultados por análisis)
| columna | tipo | notas |
|---|---|---|
| `id` | uuid PK | |
| `analysis_id` | uuid FK→analyses | on delete cascade |
| `name` | text | |
| `reason` | text | del LLM |
| `nutrition_query` | text | la cadena |
| `assumptions` | text | del LLM |
| `conflicts` | text[] | |
| `approx_macros` | jsonb | estimación LLM `{kcal,protein_g,carbs_g,fat_g}` |
| `grounded_macros` | jsonb | de API Ninjas (agregado + breakdown por ingrediente) |
| `llm_draft_verdict` | text | solo fallback |
| `final_verdict` | text | `'green'\|'amber'\|'red'` (motor) |
| `fit_score` | numeric | 0–100 (motor) |
| `rank` | int | orden final |

### RLS (todas)
```sql
alter table profiles enable row level security;
create policy "own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

alter table analyses enable row level security;
create policy "own analyses" on analyses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table dishes enable row level security;
create policy "own dishes" on dishes for all using (
  exists (select 1 from analyses a where a.id = dishes.analysis_id and a.user_id = auth.uid())
);
```
Anónimo (probar sin cuenta): pipeline en memoria, **no** escribe filas.

---

## 2. Enums compartidos

```ts
export const Goal = z.enum(["cut", "bulk", "maintain"]);
export const Diet = z.enum(["none", "vegan", "vegetarian", "keto"]);
export const Activity = z.enum(["sedentary","light","moderate","active","very_active"]);
export const Verdict = z.enum(["green", "amber", "red"]);
```

## 3. Perfil (Zod)

```ts
export const ProfileSchema = z.object({
  displayName: z.string().min(1),
  sex: z.enum(["male", "female"]),
  birthDate: z.coerce.date(),
  heightCm: z.number().min(120).max(230),
  weightKg: z.number().min(35).max(250),
  activityLevel: Activity,
  diet: Diet,
  allergies: z.array(z.string()).default([]),
  goal: Goal,
  mealsPerDay: z.number().int().min(1).max(6).default(3),
  proteinGPerKg: z.number().min(1).max(3.5).default(2.0),
  manualTdee: z.number().int().positive().nullable().default(null),
});
export type Profile = z.infer<typeof ProfileSchema>;
```

## 4. Contrato de salida del LLM (validado en el harness)

```ts
export const MacrosSchema = z.object({
  kcal: z.number(), protein_g: z.number(), carbs_g: z.number(), fat_g: z.number(),
});

export const LlmDishSchema = z.object({
  name: z.string(),
  verdict: Verdict.or(z.enum(["verde","ambar","rojo"])), // tolera ES; se normaliza
  reason: z.string(),
  nutrition_query: z.string(),
  approx: MacrosSchema,
  assumptions: z.string().default(""),
  conflicts: z.array(z.string()).default([]),
});

export const LlmResponseSchema = z.object({
  menu_read_ok: z.boolean(),
  dishes: z.array(LlmDishSchema),
  notes: z.string().optional(),
});
```
El servidor valida con `LlmResponseSchema.safeParse` tras extraer el JSON (primera `{` → última `}`).

## 5. Mapeo API Ninjas

```ts
// GET https://api.calorieninjas.com/v1/nutrition?query=...   header: X-Api-Key
// Respuesta: { items: [{ name, calories, serving_size_g, fat_total_g,
//   fat_saturated_g, protein_g, sodium_mg, potassium_mg, cholesterol_mg,
//   carbohydrates_total_g, fiber_g, sugar_g }] }   (validado en Sprint 0)
export const GroundedMacrosSchema = z.object({
  kcal: z.number(), protein_g: z.number(), carbs_g: z.number(), fat_g: z.number(),
  confidence: z.enum(["high", "medium", "low"]),       // heurística: ver abajo
  breakdown: z.array(z.object({
    item: z.string(), kcal: z.number(), protein_g: z.number(),
    carbs_g: z.number(), fat_g: z.number(),
  })),
});
```
Agregado = suma del `breakdown` (mapeando `calories→kcal`, `carbohydrates_total_g→carbs_g`, `fat_total_g→fat_g`). API Ninjas no marca ítems "no reconocidos" explícitamente: si el array de respuesta tiene **menos** items que los ingredientes separados por coma en `nutrition_query`, se asume que al menos uno no fue reconocido → `confidence = low`. Si coinciden en número → `high`. Esta heurística es v1 y debe confirmarse en Sprint 0.

## 6. Derivados en app (no persistidos)

```ts
export function bmr(p: Profile): number {
  const age = yearsSince(p.birthDate);
  const s = p.sex === "male" ? 5 : -161;
  return 10 * p.weightKg + 6.25 * p.heightCm - 5 * age + s;
}
const ACT = { sedentary:1.2, light:1.375, moderate:1.55, active:1.725, very_active:1.9 };
const GOAL_MULT = { cut:0.80, maintain:1.0, bulk:1.12 };

export function targets(p: Profile) {
  const tdee = p.manualTdee ?? Math.round(bmr(p) * ACT[p.activityLevel]);
  const dailyKcal = Math.round(tdee * GOAL_MULT[p.goal]);
  const dailyProtein = Math.round(p.weightKg * p.proteinGPerKg);
  return {
    tdee,
    mealKcal: Math.round(dailyKcal / p.mealsPerDay),
    mealProtein: Math.round(dailyProtein / p.mealsPerDay),
  };
}
```

## 7. Módulo de scoring determinista (v1, tuneable)

```ts
type Grounded = z.infer<typeof GroundedMacrosSchema>;
type Target = { mealKcal: number; mealProtein: number };

const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));

export function scoreDish(m: Grounded, t: Target, goal: Goal, hardRed: boolean) {
  if (hardRed) return { verdict: "red" as const, fitScore: 0 };

  const proteinPct = (m.protein_g * 4) / Math.max(m.kcal, 1);
  const fatPct     = (m.fat_g * 9)    / Math.max(m.kcal, 1);
  const kcalRatio    = m.kcal / Math.max(t.mealKcal, 1);
  const proteinRatio = m.protein_g / Math.max(t.mealProtein, 1);

  let s = 0;
  if (goal === "cut") {
    s = 100 * (0.5 * clamp(proteinPct / 0.40)
             + 0.3 * (1 - clamp(kcalRatio - 1))       // penaliza pasarse de kcal
             + 0.2 * (1 - clamp(fatPct / 0.45)));
  } else if (goal === "bulk") {
    s = 100 * (0.45 * clamp(kcalRatio / 1.2)          // premia kcal hacia/por encima
             + 0.35 * clamp(proteinRatio)
             + 0.20 * clamp((m.carbs_g * 4) / Math.max(m.kcal,1) / 0.5));
  } else { // maintain
    s = 100 * (0.5 * (1 - clamp(Math.abs(kcalRatio - 1))) // premia cercanía al target
             + 0.3 * clamp(proteinRatio)
             + 0.2 * (1 - clamp(fatPct / 0.45)));
  }

  const verdict = s >= 70 ? "green" : s >= 45 ? "amber" : "red";
  return { verdict, fitScore: Math.round(s) };
}
```
`hardRed` = alérgeno presente **o** conflicto de dieta. Estos umbrales (0.40, 0.45, 70/45) son v1 y deben recalibrarse contra un set de juicios reales.

## 8. Contratos de API (Route Handlers)

### `POST /api/analyze`
Orquesta todo el pipeline en el servidor (la key de API Ninjas nunca toca el cliente).

```ts
// Request (multipart: files[] + json)
export const AnalyzeRequestSchema = z.object({
  goal: Goal,
  profileSnapshot: z.object({          // targets ya calculados en cliente o recalculados aquí
    mealKcal: z.number(), mealProtein: z.number(),
    diet: Diet, allergies: z.array(z.string()),
  }),
  // files van en el multipart, no en el JSON
});

// Response
export const AnalyzeResponseSchema = z.object({
  analysisId: z.string().nullable(),   // null si anónimo
  menuReadOk: z.boolean(),
  notes: z.string().optional(),
  dishes: z.array(z.object({
    name: z.string(),
    reason: z.string(),
    nutritionQuery: z.string(),
    assumptions: z.string(),
    conflicts: z.array(z.string()),
    approxMacros: MacrosSchema,
    groundedMacros: GroundedMacrosSchema.nullable(), // null si API Ninjas falló
    verdict: Verdict,
    fitScore: z.number(),
  })),
});
```

Pipeline interno:
```
1. Claude visión → LlmResponseSchema (validar)
2. Por plato (en paralelo, con límite): ApiNinjas(nutrition_query) → GroundedMacros
   - si falla: groundedMacros=null, usar llm_draft_verdict como fallback
3. hardRed = allergyHit || dietConflict(plato, diet)
4. scoreDish(grounded, target, goal, hardRed) → verdict + fitScore
5. ordenar por (verdict green>amber>red, luego fitScore desc)
6. si user autenticado: persistir analyses + dishes
7. devolver AnalyzeResponse
```

### `GET /api/analyses` · `GET /api/analyses/:id`
Historial del usuario autenticado (RLS ya filtra).

---

## 9. Estructura de carpetas (Next.js 16)

```
/app
  /api/analyze/route.ts
  /api/analyses/route.ts
  /(app)/analyze/page.tsx        # subir + resultados
  /(app)/profile/page.tsx        # perfil + TDEE
  /(app)/history/page.tsx
/lib
  /nutrition/targets.ts          # §6
  /nutrition/scoring.ts          # §7
  /nutrition/api-ninjas.ts       # §5 cliente
  /llm/read-menu.ts              # §4 llamada Claude + validación
  /supabase/{client,server}.ts
/schemas                         # todos los Zod de este doc
/components/{ui,features}
```
