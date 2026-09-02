import type { AnalyzedDish } from "@/schemas";

export type DishRow = {
  id: string;
  name: string;
  reason: string | null;
  nutrition_query: string;
  assumptions: string | null;
  conflicts: string[] | null;
  approx_macros: unknown;
  grounded_macros: unknown;
  final_verdict: string;
  fit_score: number;
  eaten_at: string | null;
  verdict_feedback: boolean | null;
};

export const DISH_ROW_SELECT =
  "id, name, reason, nutrition_query, assumptions, conflicts, approx_macros, grounded_macros, final_verdict, fit_score, rank, eaten_at, verdict_feedback";

export function rowToDish(d: DishRow): AnalyzedDish {
  return {
    id: d.id,
    name: d.name,
    reason: d.reason ?? "",
    nutritionQuery: d.nutrition_query,
    assumptions: d.assumptions ?? "",
    conflicts: d.conflicts ?? [],
    approxMacros: d.approx_macros as AnalyzedDish["approxMacros"],
    groundedMacros: d.grounded_macros as AnalyzedDish["groundedMacros"],
    verdict: d.final_verdict as AnalyzedDish["verdict"],
    fitScore: d.fit_score,
    eatenAt: d.eaten_at,
    verdictFeedback: d.verdict_feedback,
  };
}
