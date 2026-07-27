// Sprint 0 — valida R1 (parseabilidad API Ninjas) + R4 (cuota free tier).
// Uso: API_NINJAS_KEY=... node scripts/validate-api-ninjas.mjs
// (o `node --env-file=.env.local scripts/validate-api-ninjas.mjs` con Node 20.6+)

const API_KEY = process.env.API_NINJAS_KEY;

if (!API_KEY) {
  console.error("Falta API_NINJAS_KEY en el entorno.");
  process.exit(1);
}

// Representativas del tipo de `nutrition_query` que generará Claude tras descomponer un plato (SCHEMA §4/§5).
const QUERIES = [
  { label: "plato simple", query: "150g grilled chicken breast", expectedItems: 1 },
  {
    label: "plato compuesto multi-ingrediente (una sola query)",
    query: "200g white rice, 100g grilled chicken breast, 1 tbsp olive oil, 50g steamed broccoli",
    expectedItems: 4,
  },
  {
    label: "término traducido / no genérico",
    query: "1 serving paella with chicken, shrimp, and saffron rice",
    expectedItems: 1,
  },
];

async function validateQuery({ label, query, expectedItems }) {
  const url = `https://api.calorieninjas.com/v1/nutrition?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "X-Api-Key": API_KEY } });

  const status = res.status;
  const rawBody = await res.json().catch(() => null);
  const body = Array.isArray(rawBody) ? rawBody : rawBody?.items;

  console.log(`\n=== ${label} ===`);
  console.log("query:", query);
  console.log("http status:", status);

  if (!Array.isArray(body)) {
    console.log("RESULTADO: no parseable / sin `items[]`. Body crudo:", JSON.stringify(rawBody));
    return { label, ok: false };
  }

  console.log(`ítems devueltos: ${body.length} (esperados: ${expectedItems})`);
  for (const item of body) {
    console.log(
      `  - ${item.name}: ${item.calories} kcal, ${item.protein_g}g prot, ${item.carbohydrates_total_g}g carb, ${item.fat_total_g}g grasa`
    );
  }

  const macrosPresent = body.length > 0 && body.every((f) => f.calories != null);
  const confidence = body.length >= expectedItems ? "high" : body.length > 0 ? "low" : "none";
  console.log("confianza (heurística SCHEMA §5):", confidence);
  console.log("RESULTADO:", macrosPresent ? "OK (parseable, macros presentes)" : "SOSPECHOSO (revisar macros)");
  return { label, ok: macrosPresent };
}

const results = [];
for (const q of QUERIES) {
  results.push(await validateQuery(q));
}

const okCount = results.filter((r) => r.ok).length;
console.log(`\n=== GATE ===`);
console.log(`${okCount}/${results.length} queries parseables y plausibles.`);
console.log(
  okCount / results.length >= 0.9
    ? "PASA el gate (≥90%) → seguir a Sprint 1."
    : "NO pasa el gate → replantear antes de Sprint 1 (ver SPRINTS.md Sprint 0)."
);
