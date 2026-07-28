import type { AnalyzedDish } from "@/schemas";

export type DishRow = {
  name: string;
  reason: string | null;
  nutrition_query: string;
  assumptions: string | null;
  conflicts: string[] | null;
  approx_macros: unknown;
  grounded_macros: unknown;
  final_verdict: string;
  fit_score: number;
};

export const DISH_ROW_SELECT =
  "name, reason, nutrition_query, assumptions, conflicts, approx_macros, grounded_macros, final_verdict, fit_score, rank";

export function rowToDish(d: DishRow): AnalyzedDish {
  return {
    name: d.name,
    reason: d.reason ?? "",
    nutritionQuery: d.nutrition_query,
    assumptions: d.assumptions ?? "",
    conflicts: d.conflicts ?? [],
    approxMacros: d.approx_macros as AnalyzedDish["approxMacros"],
    groundedMacros: d.grounded_macros as AnalyzedDish["groundedMacros"],
    verdict: d.final_verdict as AnalyzedDish["verdict"],
    fitScore: d.fit_score,
  };
}
