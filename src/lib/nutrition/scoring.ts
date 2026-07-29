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
 * Formatea gramos para el mensaje de `hardLimitReasons`: entero si es un valor entero, si no
 * redondea HACIA ARRIBA a 1 decimal (no `Math.round`). Con `Math.round`, un exceso real pero
 * diminuto (p.ej. 20.04g contra un límite de 20g, típico al sumar macros de ingredientes)
 * redondearía a 20.0 y produciría "20g > 20g/comida" — el mismo bug que esto arregla, solo
 * más difícil de ver. `Math.ceil` garantiza que si x > límite (entero), el valor impreso
 * también sea > límite.
 */
function formatGrams(x: number): number {
  return Number.isInteger(x) ? x : Math.ceil(x * 10) / 10;
}

/**
 * Razones legibles cuando el hard-conflict viene de un límite numérico (grasa/carbos), no de
 * `conflicts[]` (LLM). Sin esto la UI no explicaba por qué un plato caía en rojo/0 al chocar
 * con un límite: `dish-result-card.tsx` solo pinta `conflicts[]`, así que estas razones se
 * anexan ahí en `route.ts` para que el usuario vea el motivo real.
 */
export function hardLimitReasons(
  grounded: Macros | null,
  diet: Diet,
  fatLimitG: number | null = null,
  carbLimitG: number | null = null
): string[] {
  if (!grounded) return [];
  const reasons: string[] = [];
  const effectiveCarbLimit = carbLimitG ?? (diet === "keto" ? KETO_CARB_LIMIT_G : null);
  if (effectiveCarbLimit !== null && grounded.carbs_g > effectiveCarbLimit) {
    reasons.push(
      `Supera límite de carbohidratos (${formatGrams(grounded.carbs_g)}g > ${effectiveCarbLimit}g/comida)`
    );
  }
  if (fatLimitG !== null && grounded.fat_g > fatLimitG) {
    reasons.push(`Supera límite de grasa (${formatGrams(grounded.fat_g)}g > ${fatLimitG}g/comida)`);
  }
  return reasons;
}
