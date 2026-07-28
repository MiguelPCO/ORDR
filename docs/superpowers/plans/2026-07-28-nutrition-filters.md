# Filtros Nutricionales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent profile-level nutrition filters (dislikes, fat/carb limits per meal) plus session-level overrides in `/analyze`, all enforced as hard guardrails by `hasHardConflict` (never by the LLM directly).

**Architecture:** Extend `ProfileSchema`/`AnalyzeRequestSchema` with 3 new profile fields + 4 session-override fields; extend the pure `hasHardConflict` scoring function with two optional numeric-limit params; wire the union (allergies/dislikes) and override (fat/carb limits) logic in `/api/analyze/route.ts`; add matching UI in `ProfileForm` (persistent defaults) and `AnalyzeClient` (collapsible session overrides).

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Zod, Supabase (Postgres + RLS), Vitest, React Hook Form.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-28-nutrition-filters-design.md` (approved, commit `1c794cc`).
- "No me gusta" is a hard guardrail — same treatment as allergy/diet conflict: `verdict=red`, `fitScore=0`. Never a soft penalty.
- v1 scope: only fat + carbs limits. No sodium/sugar (explicit out-of-scope, YAGNI).
- Limits are grams **per meal**, optional numeric field, empty = no limit (never `0` or `NaN`).
- Session overrides: allergies/dislikes **union** with profile (session never replaces profile protections). Fat/carb limits **override** profile default for that session only (never written back to profile).
- `hasHardConflict` computes the verdict in code — the LLM only ever supplies `conflicts` (declared allergens/dislikes), never the red/green verdict itself.
- Keto's hardcoded 20g carb limit becomes the *default* for `carbLimitG` when the diet is keto and the user has set no explicit `carbLimitG` — existing behavior preserved, not a regression.
- New Supabase migration only — never edit an already-applied migration file.
- This plan is independent of the `analyze-mobile-ux` branch/worktree (UI-only, unmerged). Built directly on `master`.

---

### Task 1: Migration — add profile filter columns

**Files:**
- Create: `supabase/migrations/20260729000001_add_profile_filters.sql`

**Interfaces:**
- Produces: three new nullable/default columns on `profiles`: `dislikes text[]`, `fat_limit_g numeric`, `carb_limit_g numeric` — consumed by Task 4 (`profile-row.ts`) and Task 5 (`actions.ts`).

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260729000001_add_profile_filters.sql
alter table profiles
  add column dislikes text[] not null default '{}',
  add column fat_limit_g numeric,
  add column carb_limit_g numeric;
```

- [ ] **Step 2: Apply locally (if a local Supabase/Postgres instance is configured) or note for the user to run it against their project**

Run: `supabase db push` (or execute the SQL directly in the Supabase SQL editor if no local CLI link exists).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260729000001_add_profile_filters.sql
git commit -m "db: add dislikes/fat_limit_g/carb_limit_g columns to profiles"
```

---

### Task 2: Schema — extend ProfileSchema and AnalyzeRequestSchema

**Files:**
- Modify: `src/schemas/index.ts:15-28` (ProfileSchema), `src/schemas/index.ts:74-82` (AnalyzeRequestSchema)

**Interfaces:**
- Consumes: nothing new (pure Zod schema).
- Produces: `Profile` type gains `dislikes: string[]`, `fatLimitG: number | null`, `carbLimitG: number | null` — consumed by Tasks 4, 5, 6, 9. `AnalyzeRequestSchema.profileSnapshot` gains `dislikes: string[]`, `allergiesExtra: string[]`, `dislikesExtra: string[]`, `fatLimitG: number | null`, `carbLimitG: number | null` — consumed by Tasks 8, 9.

- [ ] **Step 1: Update ProfileSchema**

Replace `src/schemas/index.ts:15-28`:

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
  dislikes: z.array(z.string()).default([]),
  goal: Goal,
  mealsPerDay: z.number().int().min(1).max(6).default(3),
  proteinGPerKg: z.number().min(1).max(3.5).default(2.0),
  manualTdee: z.number().int().positive().nullable().default(null),
  fatLimitG: z.number().positive().nullable().default(null),
  carbLimitG: z.number().positive().nullable().default(null),
});
export type Profile = z.infer<typeof ProfileSchema>;
```

- [ ] **Step 2: Update AnalyzeRequestSchema**

Replace `src/schemas/index.ts:74-82`:

```ts
export const AnalyzeRequestSchema = z.object({
  goal: Goal,
  profileSnapshot: z.object({
    mealKcal: z.number(),
    mealProtein: z.number(),
    diet: Diet,
    allergies: z.array(z.string()),
    allergiesExtra: z.array(z.string()).default([]),
    dislikes: z.array(z.string()).default([]),
    dislikesExtra: z.array(z.string()).default([]),
    fatLimitG: z.number().positive().nullable().default(null),
    carbLimitG: z.number().positive().nullable().default(null),
  }),
});
```

- [ ] **Step 3: Verify the project still type-checks**

Run: `npx tsc --noEmit`
Expected: Errors in `profile-row.ts`, `actions.ts`, `profile-form.tsx`, `read-menu.ts`, `route.ts`, `analyze-client.tsx` are EXPECTED at this point (they consume the old shape and are fixed in Tasks 4-9). Confirm there are no errors *inside* `src/schemas/index.ts` itself.

- [ ] **Step 4: Commit**

```bash
git add src/schemas/index.ts
git commit -m "schema: add dislikes/fatLimitG/carbLimitG to Profile and AnalyzeRequest"
```

---

### Task 3: Scoring engine — extend hasHardConflict (TDD)

**Files:**
- Modify: `src/lib/nutrition/scoring.ts:57-65`
- Create: `src/lib/nutrition/scoring.test.ts`

**Interfaces:**
- Consumes: `Macros` type (from `@/schemas`), `Diet` type (from `@/schemas`) — unchanged.
- Produces: `hasHardConflict(conflicts: string[], grounded: Macros | null, diet: Diet, fatLimitG?: number | null, carbLimitG?: number | null): boolean` — consumed by Task 8 (`route.ts`).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/nutrition/scoring.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { hasHardConflict } from "./scoring";

const macros = (overrides: Partial<{ kcal: number; protein_g: number; carbs_g: number; fat_g: number }>) => ({
  kcal: 500,
  protein_g: 30,
  carbs_g: 40,
  fat_g: 15,
  ...overrides,
});

describe("hasHardConflict", () => {
  it("returns true when conflicts array is non-empty (allergy/dislike declared by LLM)", () => {
    expect(hasHardConflict(["gluten"], null, "none")).toBe(true);
  });

  it("returns true when grounded fat_g exceeds an explicit fatLimitG", () => {
    const grounded = macros({ fat_g: 25 });
    expect(hasHardConflict([], grounded, "none", 20, null)).toBe(true);
  });

  it("returns false when grounded fat_g is within fatLimitG", () => {
    const grounded = macros({ fat_g: 15 });
    expect(hasHardConflict([], grounded, "none", 20, null)).toBe(false);
  });

  it("an explicit carbLimitG different from 20 overrides the keto default", () => {
    const grounded = macros({ carbs_g: 30 });
    // keto default would flag this at 20g, but an explicit 40g limit should NOT flag it
    expect(hasHardConflict([], grounded, "keto", null, 40)).toBe(false);
  });

  it("keto diet with no explicit carbLimitG still uses the 20g default", () => {
    const grounded = macros({ carbs_g: 25 });
    expect(hasHardConflict([], grounded, "keto", null, null)).toBe(true);
  });

  it("keto diet with no explicit carbLimitG and carbs within 20g default returns false", () => {
    const grounded = macros({ carbs_g: 15 });
    expect(hasHardConflict([], grounded, "keto", null, null)).toBe(false);
  });

  it("non-keto diet with no explicit carbLimitG has no carb ceiling at all", () => {
    const grounded = macros({ carbs_g: 200 });
    expect(hasHardConflict([], grounded, "none", null, null)).toBe(false);
  });

  it("returns false when grounded is null and no conflicts (approx-only fallback, no numeric check possible)", () => {
    expect(hasHardConflict([], null, "none", 20, 20)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/nutrition/scoring.test.ts`
Expected: FAIL — `hasHardConflict` does not yet accept 4th/5th params, so the keto-override and fatLimitG tests fail (TS error or wrong boolean).

- [ ] **Step 3: Implement the extended hasHardConflict**

Replace `src/lib/nutrition/scoring.ts:57-65`:

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/nutrition/scoring.test.ts`
Expected: PASS (8/8).

- [ ] **Step 5: Commit**

```bash
git add src/lib/nutrition/scoring.ts src/lib/nutrition/scoring.test.ts
git commit -m "feat: extend hasHardConflict with fatLimitG/carbLimitG guardrails"
```

---

### Task 4: profile-row.ts — map new columns

**Files:**
- Modify: `src/lib/supabase/profile-row.ts` (whole file, currently 37 lines)

**Interfaces:**
- Consumes: `Profile` type (from `@/schemas`, updated in Task 2).
- Produces: `ProfileRow` type and `rowToProfile()` gain `dislikes`/`fat_limit_g`/`carb_limit_g` ↔ `dislikes`/`fatLimitG`/`carbLimitG` — consumed by Task 5's read paths (server components loading the profile) unchanged in shape from before, just extended.

- [ ] **Step 1: Update the file**

Replace the whole file `src/lib/supabase/profile-row.ts`:

```ts
import type { Profile } from "@/schemas";

export type ProfileRow = {
  display_name: string;
  sex: string;
  birth_date: string;
  height_cm: number;
  weight_kg: number;
  activity_level: string;
  diet: string;
  allergies: string[];
  dislikes: string[];
  goal: string;
  meals_per_day: number;
  protein_g_per_kg: number;
  manual_tdee: number | null;
  fat_limit_g: number | null;
  carb_limit_g: number | null;
};

export const PROFILE_ROW_SELECT =
  "display_name, sex, birth_date, height_cm, weight_kg, activity_level, diet, allergies, dislikes, goal, meals_per_day, protein_g_per_kg, manual_tdee, fat_limit_g, carb_limit_g";

export function rowToProfile(row: ProfileRow): Profile {
  return {
    displayName: row.display_name,
    sex: row.sex as Profile["sex"],
    birthDate: new Date(row.birth_date),
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    activityLevel: row.activity_level as Profile["activityLevel"],
    diet: row.diet as Profile["diet"],
    allergies: row.allergies,
    dislikes: row.dislikes,
    goal: row.goal as Profile["goal"],
    mealsPerDay: row.meals_per_day,
    proteinGPerKg: row.protein_g_per_kg,
    manualTdee: row.manual_tdee,
    fatLimitG: row.fat_limit_g,
    carbLimitG: row.carb_limit_g,
  };
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: `profile-row.ts` no longer errors. Remaining errors (if any) are in files fixed by later tasks.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/profile-row.ts
git commit -m "feat: map dislikes/fatLimitG/carbLimitG in profile-row"
```

---

### Task 5: profile/actions.ts — persist new fields

**Files:**
- Modify: `src/app/(app)/profile/actions.ts` (whole file, currently 60 lines)

**Interfaces:**
- Consumes: `ProfileSchema` (Task 2), `PROFILE_ROW_SELECT`-shaped column names (Task 4).
- Produces: nothing new consumed by later tasks — this is the write-path terminal for `ProfileForm`'s persisted-mode submit (Task 6).

- [ ] **Step 1: Update saveProfile**

Replace the whole file `src/app/(app)/profile/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileSchema } from "@/schemas";

export async function saveProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const parsed = ProfileSchema.safeParse({
    displayName: formData.get("displayName"),
    sex: formData.get("sex"),
    birthDate: formData.get("birthDate"),
    heightCm: Number(formData.get("heightCm")),
    weightKg: Number(formData.get("weightKg")),
    activityLevel: formData.get("activityLevel"),
    diet: formData.get("diet"),
    allergies: String(formData.get("allergies") ?? "")
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean),
    dislikes: String(formData.get("dislikes") ?? "")
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean),
    goal: formData.get("goal"),
    mealsPerDay: Number(formData.get("mealsPerDay")),
    proteinGPerKg: Number(formData.get("proteinGPerKg")),
    manualTdee: formData.get("manualTdee") ? Number(formData.get("manualTdee")) : null,
    fatLimitG: formData.get("fatLimitG") ? Number(formData.get("fatLimitG")) : null,
    carbLimitG: formData.get("carbLimitG") ? Number(formData.get("carbLimitG")) : null,
  });

  if (!parsed.success) {
    redirect(`/profile?error=${encodeURIComponent(parsed.error.message)}`);
  }

  const p = parsed.data;
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    display_name: p.displayName,
    sex: p.sex,
    birth_date: p.birthDate.toISOString().slice(0, 10),
    height_cm: p.heightCm,
    weight_kg: p.weightKg,
    activity_level: p.activityLevel,
    diet: p.diet,
    allergies: p.allergies,
    dislikes: p.dislikes,
    goal: p.goal,
    meals_per_day: p.mealsPerDay,
    protein_g_per_kg: p.proteinGPerKg,
    manual_tdee: p.manualTdee,
    fat_limit_g: p.fatLimitG,
    carb_limit_g: p.carbLimitG,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    redirect(`/profile?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/profile?saved=1");
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: `actions.ts` no longer errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/profile/actions.ts"
git commit -m "feat: persist dislikes/fatLimitG/carbLimitG on profile save"
```

---

### Task 6: profile-form.tsx — UI for persistent defaults

**Files:**
- Modify: `src/components/features/profile-form.tsx` (whole file, currently 311 lines)

**Interfaces:**
- Consumes: `ProfileSchema`/`Profile` (Task 2).
- Produces: nothing new consumed by later tasks (leaf UI component); `onSave`/`saveProfile` paths both carry the 3 new fields through to whichever persistence path is active (session store for anonymous, `saveProfile` for authenticated).

- [ ] **Step 1: Extend FormValues and toDefault**

In `src/components/features/profile-form.tsx`, replace lines 9-22 (`FormValues` type):

```ts
type FormValues = {
  displayName: string;
  sex: "male" | "female";
  birthDate: string;
  heightCm: number;
  weightKg: number;
  activityLevel: Profile["activityLevel"];
  diet: Profile["diet"];
  allergies: string;
  dislikes: string;
  goal: Profile["goal"];
  mealsPerDay: number;
  proteinGPerKg: number;
  manualTdee: number | "";
  fatLimitG: number | "";
  carbLimitG: number | "";
};
```

Replace lines 24-55 (`toDefault`):

```ts
function toDefault(profile: Profile | null): FormValues {
  if (!profile) {
    return {
      displayName: "",
      sex: "male",
      birthDate: "",
      heightCm: 175,
      weightKg: 75,
      activityLevel: "moderate",
      diet: "none",
      allergies: "",
      dislikes: "",
      goal: "maintain",
      mealsPerDay: 3,
      proteinGPerKg: 2.0,
      manualTdee: "",
      fatLimitG: "",
      carbLimitG: "",
    };
  }
  return {
    displayName: profile.displayName,
    sex: profile.sex,
    birthDate: profile.birthDate.toISOString().slice(0, 10),
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    activityLevel: profile.activityLevel,
    diet: profile.diet,
    allergies: profile.allergies.join(", "),
    dislikes: profile.dislikes.join(", "),
    goal: profile.goal,
    mealsPerDay: profile.mealsPerDay,
    proteinGPerKg: profile.proteinGPerKg,
    manualTdee: profile.manualTdee ?? "",
    fatLimitG: profile.fatLimitG ?? "",
    carbLimitG: profile.carbLimitG ?? "",
  };
}
```

- [ ] **Step 2: Extend parse() and the authenticated FormData submit path**

Replace lines 76-83 (`parse`):

```ts
function parse(values: FormValues) {
  return ProfileSchema.safeParse({
    ...values,
    displayName: onSave ? values.displayName || "Invitado" : values.displayName,
    allergies: values.allergies.split(",").map((a) => a.trim()).filter(Boolean),
    dislikes: values.dislikes.split(",").map((d) => d.trim()).filter(Boolean),
    manualTdee: values.manualTdee === "" ? null : Number(values.manualTdee),
    fatLimitG: values.fatLimitG === "" ? null : Number(values.fatLimitG),
    carbLimitG: values.carbLimitG === "" ? null : Number(values.carbLimitG),
  });
}
```

Replace lines 104-117 (the FormData block inside `onSubmit`):

```ts
    const fd = new FormData();
    fd.set("displayName", values.displayName);
    fd.set("sex", values.sex);
    fd.set("birthDate", values.birthDate);
    fd.set("heightCm", String(values.heightCm));
    fd.set("weightKg", String(values.weightKg));
    fd.set("activityLevel", values.activityLevel);
    fd.set("diet", values.diet);
    fd.set("allergies", values.allergies);
    fd.set("dislikes", values.dislikes);
    fd.set("goal", values.goal);
    fd.set("mealsPerDay", String(values.mealsPerDay));
    fd.set("proteinGPerKg", String(values.proteinGPerKg));
    if (values.manualTdee !== "") fd.set("manualTdee", String(values.manualTdee));
    if (values.fatLimitG !== "") fd.set("fatLimitG", String(values.fatLimitG));
    if (values.carbLimitG !== "") fd.set("carbLimitG", String(values.carbLimitG));
    await saveProfile(fd);
```

- [ ] **Step 3: Add the 3 new inputs to the JSX**

After the "Alergias" block (currently lines 236-245), insert a new "Dislikes" block:

```tsx
      <div className="space-y-1">
        <label htmlFor="dislikes" className="text-sm font-medium">
          No me gusta (separado por coma)
        </label>
        <input
          id="dislikes"
          className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          {...register("dislikes")}
        />
      </div>
```

Replace the 3-column grid at lines 247-283 (mealsPerDay/proteinGPerKg/manualTdee) to add 2 more numeric inputs in a second row, changing the grid to `grid-cols-2` for the new row:

```tsx
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <label htmlFor="mealsPerDay" className="text-sm font-medium">
            Comidas/día
          </label>
          <input
            id="mealsPerDay"
            type="number"
            className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            {...register("mealsPerDay", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="proteinGPerKg" className="text-sm font-medium">
            g prot/kg
          </label>
          <input
            id="proteinGPerKg"
            type="number"
            step="0.1"
            className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            {...register("proteinGPerKg", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="manualTdee" className="text-sm font-medium">
            TDEE manual
          </label>
          <input
            id="manualTdee"
            type="number"
            placeholder="opcional"
            className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            {...register("manualTdee")}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="fatLimitG" className="text-sm font-medium">
            Límite grasa (g/comida)
          </label>
          <input
            id="fatLimitG"
            type="number"
            placeholder="sin límite"
            className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            {...register("fatLimitG")}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="carbLimitG" className="text-sm font-medium">
            Límite carbos (g/comida)
          </label>
          <input
            id="carbLimitG"
            type="number"
            placeholder="sin límite"
            className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            {...register("carbLimitG")}
          />
        </div>
      </div>
```

- [ ] **Step 4: Verify type-check and manual smoke test**

Run: `npx tsc --noEmit`
Expected: `profile-form.tsx` no longer errors.

Run: `npm run dev`, open `/profile`, fill "No me gusta" + both limit fields, save, reload — confirm values persist (requires Task 1 migration applied).

- [ ] **Step 5: Commit**

```bash
git add src/components/features/profile-form.tsx
git commit -m "feat: add dislikes/fatLimitG/carbLimitG inputs to ProfileForm"
```

---

### Task 7: read-menu.ts — pass dislikes to the LLM prompt

**Files:**
- Modify: `src/lib/llm/read-menu.ts:11-14` (ReadMenuProfile), `src/lib/llm/read-menu.ts:16-35` (SYSTEM_PROMPT), `src/lib/llm/read-menu.ts:37-41` (buildUserText)

**Interfaces:**
- Consumes: nothing new (own local type, not from `@/schemas`).
- Produces: `ReadMenuProfile` gains `dislikes: string[]` — consumed by Task 8 (`route.ts`'s `readMenu()` call).

- [ ] **Step 1: Extend ReadMenuProfile**

Replace `src/lib/llm/read-menu.ts:11-14`:

```ts
export type ReadMenuProfile = {
  diet: Diet;
  allergies: string[];
  dislikes: string[];
};
```

- [ ] **Step 2: Update SYSTEM_PROMPT point 7**

Replace point 7 inside `SYSTEM_PROMPT` (currently line 26):

```
7. "conflicts": array de strings — cualquier conflicto con la dieta, las alergias, y los ingredientes que el usuario dice que no le gustan (te las paso en el siguiente mensaje). Si hay un alérgeno presente O un ingrediente de la lista "no me gusta", decláralo explícitamente aquí — mismo trato para ambos casos.
```

- [ ] **Step 3: Update buildUserText**

Replace `src/lib/llm/read-menu.ts:37-41`:

```ts
function buildUserText(profile: ReadMenuProfile): string {
  return `Perfil del usuario — dieta: "${profile.diet}", alergias: [${profile.allergies
    .map((a) => `"${a}"`)
    .join(", ")}], no le gusta: [${profile.dislikes
    .map((d) => `"${d}"`)
    .join(", ")}]. Lee la carta adjunta y descompón cada plato según las instrucciones.`;
}
```

- [ ] **Step 4: Verify type-check**

Run: `npx tsc --noEmit`
Expected: `read-menu.ts` no longer errors (the file itself is now self-consistent; `route.ts`'s call site is fixed in Task 8).

- [ ] **Step 5: Commit**

```bash
git add src/lib/llm/read-menu.ts
git commit -m "feat: pass dislikes to menu-reading LLM prompt as a conflict source"
```

---

### Task 8: api/analyze/route.ts — wire unions and overrides

**Files:**
- Modify: `src/app/api/analyze/route.ts:60-63` (readMenu call), `src/app/api/analyze/route.ts:89` (hasHardConflict call)

**Interfaces:**
- Consumes: `AnalyzeRequestSchema.profileSnapshot` new fields (Task 2), `ReadMenuProfile.dislikes` (Task 7), `hasHardConflict`'s new params (Task 3).
- Produces: nothing new consumed by later tasks — this is the orchestration layer Task 9's client payload targets.

- [ ] **Step 1: Update the readMenu call**

Replace `src/app/api/analyze/route.ts:60-63`:

```ts
    llmResult = await readMenu(images, {
      diet: profileSnapshot.diet,
      allergies: [...profileSnapshot.allergies, ...profileSnapshot.allergiesExtra],
      dislikes: [...profileSnapshot.dislikes, ...profileSnapshot.dislikesExtra],
    });
```

- [ ] **Step 2: Update the hasHardConflict call**

Replace line 89:

```ts
    const hardRed = hasHardConflict(
      dish.conflicts,
      groundedMacros,
      profileSnapshot.diet,
      profileSnapshot.fatLimitG,
      profileSnapshot.carbLimitG
    );
```

- [ ] **Step 3: Verify type-check and build**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project now (all call sites fixed across Tasks 2-8).

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "feat: wire dislikes union and fat/carb limits into /api/analyze"
```

---

### Task 9: analyze-client.tsx — session-level "Más filtros" UI

**Files:**
- Modify: `src/components/features/analyze-client.tsx` (whole file, currently 184 lines)

**Interfaces:**
- Consumes: `AnalyzeRequestSchema.profileSnapshot` field names (Task 2), `Profile.dislikes`/`fatLimitG`/`carbLimitG` (Task 2).
- Produces: nothing new consumed by later tasks (this is the final leaf of the chain).

- [ ] **Step 1: Add session filter state**

After line 32 (`const [goal, setGoal] = useState<Goal | null>(null);`), add:

```ts
  const [sessionAllergiesExtra, setSessionAllergiesExtra] = useState("");
  const [sessionDislikesExtra, setSessionDislikesExtra] = useState("");
  const [sessionFatLimitG, setSessionFatLimitG] = useState<number | "">("");
  const [sessionCarbLimitG, setSessionCarbLimitG] = useState<number | "">("");
```

- [ ] **Step 2: Initialize the limit fields from the profile once it's known**

After line 63 (`const sessionGoal = goal ?? profile.goal;`), add:

```ts
  const effectiveFatLimitG = sessionFatLimitG === "" ? profile.fatLimitG : sessionFatLimitG;
  const effectiveCarbLimitG = sessionCarbLimitG === "" ? profile.carbLimitG : sessionCarbLimitG;
```

- [ ] **Step 3: Extend the handleSubmit payload**

Replace the `profileSnapshot` object inside `handleSubmit` (currently lines 92-97):

```ts
        profileSnapshot: {
          mealKcal: t.mealKcal,
          mealProtein: t.mealProtein,
          diet: profile!.diet,
          allergies: profile!.allergies,
          allergiesExtra: sessionAllergiesExtra
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean),
          dislikes: profile!.dislikes,
          dislikesExtra: sessionDislikesExtra
            .split(",")
            .map((d) => d.trim())
            .filter(Boolean),
          fatLimitG: effectiveFatLimitG,
          carbLimitG: effectiveCarbLimitG,
        },
```

- [ ] **Step 4: Add the collapsible "Más filtros" section to the JSX**

After the "Objetivo de esta sesión" block (currently lines 132-148), insert:

```tsx
      <details className="rounded-md border border-foreground/20 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">Más filtros</summary>
        <div className="mt-3 space-y-3">
          <div className="space-y-1">
            <label htmlFor="sessionAllergiesExtra" className="text-sm font-medium">
              Alergias extra para esta carta
            </label>
            <input
              id="sessionAllergiesExtra"
              value={sessionAllergiesExtra}
              onChange={(e) => setSessionAllergiesExtra(e.target.value)}
              className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="sessionDislikesExtra" className="text-sm font-medium">
              No me gusta extra para esta carta
            </label>
            <input
              id="sessionDislikesExtra"
              value={sessionDislikesExtra}
              onChange={(e) => setSessionDislikesExtra(e.target.value)}
              className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="sessionFatLimitG" className="text-sm font-medium">
                Límite grasa (g)
              </label>
              <input
                id="sessionFatLimitG"
                type="number"
                placeholder="sin límite"
                value={sessionFatLimitG}
                onChange={(e) =>
                  setSessionFatLimitG(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="sessionCarbLimitG" className="text-sm font-medium">
                Límite carbos (g)
              </label>
              <input
                id="sessionCarbLimitG"
                type="number"
                placeholder="sin límite"
                value={sessionCarbLimitG}
                onChange={(e) =>
                  setSessionCarbLimitG(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      </details>
```

- [ ] **Step 5: Verify type-check, build, and full test suite**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: succeeds.

Run: `npx vitest run`
Expected: all tests pass, including the new `scoring.test.ts` from Task 3.

- [ ] **Step 6: Manual end-to-end verification**

Run: `npm run dev`, go to `/analyze`, expand "Más filtros", set a low carb limit (e.g. `10`), analyze a real menu, confirm a dish whose grounded carbs exceed 10g comes back `red` with `fitScore: 0`.

- [ ] **Step 7: Commit**

```bash
git add src/components/features/analyze-client.tsx
git commit -m "feat: add session-level Más filtros UI to /analyze"
```

---

## Self-Review Notes

- **Spec coverage:** §3.1 schema → Task 2. §3.2 prompt → Task 7. §3.3 scoring → Task 3. §3.4 orchestration → Task 8. §3.5 DB → Task 1. §3.6 profile UI → Tasks 4/5/6. §3.7 session UI → Task 9. §6 testing → Task 3's `scoring.test.ts` + tsc/build/vitest gates repeated at Tasks 2/4/5/6/7/8/9. §7 out-of-scope items (sodium/sugar, soft penalty, session-replaces-profile) are correctly absent from all 9 tasks.
- **Placeholder scan:** no TBD/TODO; every step has literal code or an exact terminal command.
- **Type consistency:** `dislikes`/`fatLimitG`/`carbLimitG` names match verbatim across `ProfileSchema` (Task 2) → `profile-row.ts` (Task 4) → `actions.ts` (Task 5) → `profile-form.tsx` (Task 6). `allergiesExtra`/`dislikesExtra`/`fatLimitG`/`carbLimitG` in `AnalyzeRequestSchema.profileSnapshot` (Task 2) match verbatim across `route.ts` (Task 8) and `analyze-client.tsx` (Task 9). `hasHardConflict`'s 4th/5th param order (`fatLimitG`, then `carbLimitG`) matches at both its Task 3 definition and its Task 8 call site.
