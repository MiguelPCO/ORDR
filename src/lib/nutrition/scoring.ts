import { z } from "zod";
import { MacrosSchema, Diet, Goal, Verdict } from "@/schemas";

// SCHEMA.md §7 — módulo de scoring determinista (v1, tuneable contra juicios reales).
type Macros = z.infer<typeof MacrosSchema>;
export type Target = { mealKcal: number; mealProtein: number };

const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));

export function scoreDish(m: Macros, t: Target, goal: Goal, hardRed: boolean) {
  if (hardRed) return { verdict: "red" as Verdict, fitScore: 0 };

  const proteinPct = (m.protein_g * 4) / Math.max(m.kcal, 1);
  const fatPct = (m.fat_g * 9) / Math.max(m.kcal, 1);
  const kcalRatio = m.kcal / Math.max(t.mealKcal, 1);
  const proteinRatio = m.protein_g / Math.max(t.mealProtein, 1);

  let s = 0;
  if (goal === "cut") {
    s =
      100 *
      (0.5 * clamp(proteinPct / 0.4) +
        0.3 * (1 - clamp(kcalRatio - 1)) + // penaliza pasarse de kcal
        0.2 * (1 - clamp(fatPct / 0.45)));
  } else if (goal === "bulk") {
    s =
      100 *
      (0.45 * clamp(kcalRatio / 1.2) + // premia kcal hacia/por encima
        0.35 * clamp(proteinRatio) +
        0.2 * clamp((m.carbs_g * 4) / Math.max(m.kcal, 1) / 0.5));
  } else {
    // maintain
    s =
      100 *
      (0.5 * (1 - clamp(Math.abs(kcalRatio - 1))) + // premia cercanía al target
        0.3 * clamp(proteinRatio) +
        0.2 * (1 - clamp(fatPct / 0.45)));
  }

  const verdict: Verdict = s >= 70 ? "green" : s >= 45 ? "amber" : "red";
  return { verdict, fitScore: Math.round(s) };
}

const KETO_CARB_LIMIT_G = 20;
const ES_TO_VERDICT: Record<string, Verdict> = { verde: "green", ambar: "amber", rojo: "red" };

/** Normaliza el borrador de veredicto del LLM (tolera ES) al enum canónico. */
export function normalizeVerdict(v: string): Verdict {
  return (ES_TO_VERDICT[v] ?? v) as Verdict;
}

/**
 * Guardarraíl duro (PRD §9): alérgeno presente o conflicto de dieta → rojo siempre, antes de puntuar.
 * `conflicts` viene del LLM (única fuente posible para "¿qué hay en el plato?"); el chequeo de
 * carbos en keto es del lado del código porque ya tenemos macros fundados y numéricos.
 */
export function hasHardConflict(
  conflicts: string[],
  grounded: Macros | null,
  diet: Diet
): boolean {
  if (conflicts.length > 0) return true;
  if (grounded && diet === "keto" && grounded.carbs_g > KETO_CARB_LIMIT_G) return true;
  return false;
}
