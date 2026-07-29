import { describe, it, expect } from "vitest";
import { hardLimitReasons, scoreDish } from "./scoring";

const macros = (overrides: Partial<{ kcal: number; protein_g: number; carbs_g: number; fat_g: number }>) => ({
  kcal: 500,
  protein_g: 30,
  carbs_g: 40,
  fat_g: 15,
  ...overrides,
});

describe("hardLimitReasons", () => {
  it("returns empty array when grounded is null", () => {
    expect(hardLimitReasons(null, "none", 20, 100)).toEqual([]);
  });

  it("returns empty array when macros are within both limits", () => {
    const grounded = macros({ fat_g: 15, carbs_g: 40 });
    expect(hardLimitReasons(grounded, "none", 20, 100)).toEqual([]);
  });

  it("flags a fatty dish against a strict fatLimitG (Casa Benjamín: fatLimitG 20g, T-bone-style dish)", () => {
    const grounded = macros({ fat_g: 34, carbs_g: 0 });
    const reasons = hardLimitReasons(grounded, "none", 20, 100);
    expect(reasons).toEqual(["Supera límite de grasa (34g > 20g/comida)"]);
  });

  it("flags carbs over an explicit carbLimitG with a readable message", () => {
    const grounded = macros({ fat_g: 5, carbs_g: 130 });
    const reasons = hardLimitReasons(grounded, "none", null, 100);
    expect(reasons).toEqual(["Supera límite de carbohidratos (130g > 100g/comida)"]);
  });

  it("can return both reasons when a dish exceeds fat and carb limits at once", () => {
    const grounded = macros({ fat_g: 34, carbs_g: 130 });
    const reasons = hardLimitReasons(grounded, "none", 20, 100);
    expect(reasons).toEqual([
      "Supera límite de carbohidratos (130g > 100g/comida)",
      "Supera límite de grasa (34g > 20g/comida)",
    ]);
  });

  it("uses the keto 20g default when carbLimitG is not set", () => {
    const grounded = macros({ fat_g: 5, carbs_g: 25 });
    const reasons = hardLimitReasons(grounded, "keto", null, null);
    expect(reasons).toEqual(["Supera límite de carbohidratos (25g > 20g/comida)"]);
  });

  it("an explicit carbLimitG different from 20 overrides the keto default", () => {
    const grounded = macros({ carbs_g: 30 });
    // keto default would flag this at 20g, but an explicit 40g limit should NOT flag it
    expect(hardLimitReasons(grounded, "keto", null, 40)).toEqual([]);
  });

  it("non-keto diet with no explicit carbLimitG has no carb ceiling at all", () => {
    const grounded = macros({ carbs_g: 200 });
    expect(hardLimitReasons(grounded, "none", null, null)).toEqual([]);
  });

  it("does not flag when grounded fat_g exactly equals fatLimitG (strict > semantics)", () => {
    const grounded = macros({ fat_g: 20 });
    expect(hardLimitReasons(grounded, "none", 20, null)).toEqual([]);
  });

  it("never prints an equal-looking message when a float barely exceeds a whole-number limit", () => {
    const grounded = macros({ fat_g: 5, carbs_g: 20.4 });
    const reasons = hardLimitReasons(grounded, "none", null, 20);
    expect(reasons).toEqual(["Supera límite de carbohidratos (20.4g > 20g/comida)"]);
  });

  it("rounds a tiny float excess UP so the printed number always exceeds an integer limit", () => {
    const grounded = macros({ fat_g: 5, carbs_g: 20.04 });
    const reasons = hardLimitReasons(grounded, "none", null, 20);
    expect(reasons).toEqual(["Supera límite de carbohidratos (20.1g > 20g/comida)"]);
  });
});

describe("scoreDish", () => {
  it("returns red with fitScore 0 whenever hardRed is true, regardless of macros", () => {
    const macros = { kcal: 500, protein_g: 30, carbs_g: 40, fat_g: 15 };
    const target = { mealKcal: 700, mealProtein: 45 };
    expect(scoreDish(macros, target, "cut", true)).toEqual({ verdict: "red", fitScore: 0 });
  });
});
