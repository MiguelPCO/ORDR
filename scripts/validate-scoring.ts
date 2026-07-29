// Sprint 3 — valida scoring.ts contra macros reales fundadas por API Ninjas.
// Uso: set -a && source .env.local && set +a && npx tsx scripts/validate-scoring.ts
import { groundMacros } from "../src/lib/nutrition/api-ninjas";
import { scoreDish, hardLimitReasons } from "../src/lib/nutrition/scoring";
import type { Goal } from "../src/schemas";

const target = { mealKcal: 700, mealProtein: 45 };

async function main() {
  const cases = [
    { label: "pechuga + arroz + brócoli (alto en proteína)", query: "200g grilled chicken breast, 150g white rice, 100g steamed broccoli" },
    { label: "paella (grasa/carbo, menos denso en proteína)", query: "1 serving paella with chicken, shrimp, and saffron rice" },
  ];

  for (const c of cases) {
    const grounded = await groundMacros(c.query);
    console.log(`\n=== ${c.label} ===`);
    console.log("grounded:", grounded);

    for (const goal of ["cut", "bulk", "maintain"] as Goal[]) {
      const { verdict, fitScore } = scoreDish(grounded, target, goal, false);
      console.log(`  goal=${goal}: verdict=${verdict} fitScore=${fitScore}`);
    }
  }

  // hardRed: alergia declarada por el LLM en conflicts -> siempre rojo, pase lo que pase con macros.
  // (mismo patrón que route.ts: conflicts primero, hardRed derivado de conflicts.length > 0 —
  // hasHardConflict fue eliminado de scoring.ts por ser dead code duplicado, fix wave 2026-07-30.)
  const grounded = await groundMacros("200g grilled chicken breast");
  const dishConflicts = ["contiene gluten (alergia declarada)", ...hardLimitReasons(grounded, "none")];
  const hardRed = dishConflicts.length > 0;
  const forced = scoreDish(grounded, target, "cut", hardRed);
  console.log("\n=== guardarraíl hardRed ===");
  console.log("hardRed:", hardRed, "-> verdict/fitScore:", forced);

  // dietConflict keto: carbos altos con dieta keto -> rojo aunque el LLM no haya marcado conflicto.
  const ketoGrounded = grounded.carbs_g > 20 ? grounded : { ...grounded, carbs_g: 999 };
  const ketoConflicts = hardLimitReasons(ketoGrounded, "keto");
  console.log("keto hardRed (carbs forzados >20g):", ketoConflicts.length > 0);
}

main();
