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
