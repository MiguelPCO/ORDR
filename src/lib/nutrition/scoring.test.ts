import { describe, it, expect } from "vitest";
import { hasHardConflict, hardLimitReasons, scoreDish } from "./scoring";

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

  it("does not flag when grounded fat_g exactly equals fatLimitG (strict > semantics)", () => {
    const grounded = macros({ fat_g: 20 });
    expect(hasHardConflict([], grounded, "none", 20, null)).toBe(false);
  });
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
});

describe("scoreDish", () => {
  it("returns red with fitScore 0 whenever hardRed is true, regardless of macros", () => {
    const macros = { kcal: 500, protein_g: 30, carbs_g: 40, fat_g: 15 };
    const target = { mealKcal: 700, mealProtein: 45 };
    expect(scoreDish(macros, target, "cut", true)).toEqual({ verdict: "red", fitScore: 0 });
  });
});
