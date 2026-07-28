import { GroundedMacrosSchema } from "@/schemas";

// SCHEMA.md §5 — validado en Sprint 0 contra la API real.
const ENDPOINT = "https://api.calorieninjas.com/v1/nutrition";

type CalorieNinjasItem = {
  name: string;
  calories: number;
  protein_g: number;
  carbohydrates_total_g: number;
  fat_total_g: number;
};

/** Funde una `nutrition_query` (ingredientes puros, ver read-menu.ts) en macros reales. */
export async function groundMacros(nutritionQuery: string) {
  const apiKey = process.env.API_NINJAS_KEY;
  if (!apiKey) {
    throw new Error("Falta API_NINJAS_KEY en el entorno.");
  }

  const url = `${ENDPOINT}?query=${encodeURIComponent(nutritionQuery)}`;
  const res = await fetch(url, { headers: { "X-Api-Key": apiKey } });

  if (!res.ok) {
    throw new Error(`API Ninjas respondió ${res.status}`);
  }

  const rawBody: unknown = await res.json().catch(() => null);
  const items: CalorieNinjasItem[] | undefined = Array.isArray(rawBody)
    ? rawBody
    : (rawBody as { items?: CalorieNinjasItem[] } | null)?.items;

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("API Ninjas no devolvió items reconocibles.");
  }

  const breakdown = items.map((item) => ({
    item: item.name,
    kcal: item.calories,
    protein_g: item.protein_g,
    carbs_g: item.carbohydrates_total_g,
    fat_g: item.fat_total_g,
  }));

  const aggregate = breakdown.reduce(
    (acc, b) => ({
      kcal: acc.kcal + b.kcal,
      protein_g: acc.protein_g + b.protein_g,
      carbs_g: acc.carbs_g + b.carbs_g,
      fat_g: acc.fat_g + b.fat_g,
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  // Heurística SCHEMA §5: nº de ingredientes separados por coma en la query vs ítems devueltos.
  const expectedItems = nutritionQuery.split(",").length;
  const ratio = items.length / expectedItems;
  const confidence = ratio >= 1 ? "high" : ratio >= 0.5 ? "medium" : "low";

  return GroundedMacrosSchema.parse({ ...aggregate, confidence, breakdown });
}

const CONCURRENCY_LIMIT = 5;

/**
 * Funde N queries con concurrencia limitada (evita saturar la cuota free tier, R4).
 * Fallo por-plato no aborta el batch: ese plato queda `null` (fallback en el caller).
 */
export async function groundMacrosBatch(
  queries: string[]
): Promise<Array<Awaited<ReturnType<typeof groundMacros>> | null>> {
  const results: Array<Awaited<ReturnType<typeof groundMacros>> | null> = new Array(
    queries.length
  ).fill(null);

  let next = 0;
  async function worker() {
    while (next < queries.length) {
      const i = next++;
      try {
        results[i] = await groundMacros(queries[i]);
      } catch {
        results[i] = null;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY_LIMIT, queries.length) }, worker)
  );

  return results;
}
