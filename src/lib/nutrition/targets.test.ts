import { describe, expect, it } from "vitest";
import { bmr, targets } from "./targets";
import type { Profile } from "@/schemas";

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    displayName: "Test",
    sex: "male",
    birthDate: new Date(new Date().getFullYear() - 30, 0, 1), // 30 años exactos
    heightCm: 180,
    weightKg: 80,
    activityLevel: "moderate",
    diet: "none",
    allergies: [],
    dislikes: [],
    goal: "cut",
    mealsPerDay: 3,
    proteinGPerKg: 2.0,
    manualTdee: null,
    bodyFatPct: null,
    fatLimitG: null,
    carbLimitG: null,
    ...overrides,
  };
}

describe("bmr", () => {
  it("aplica Mifflin-St Jeor para hombre", () => {
    const p = makeProfile();
    // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    expect(bmr(p)).toBe(1780);
  });

  it("aplica offset distinto para mujer", () => {
    const p = makeProfile({ sex: "female" });
    // 10*80 + 6.25*180 - 5*30 - 161 = 800 + 1125 - 150 - 161 = 1614
    expect(bmr(p)).toBe(1614);
  });

  it("usa Katch-McArdle cuando hay bodyFatPct, ignorando Mifflin-St Jeor", () => {
    const p = makeProfile({ weightKg: 80, bodyFatPct: 15 });
    // LBM = 80 * (1 - 15/100) = 68 ; BMR = 370 + 21.6*68 = 1838.8
    expect(bmr(p)).toBeCloseTo(1838.8, 5);
  });

  it("Katch-McArdle no depende de sexo/altura/edad (solo peso y % grasa)", () => {
    const p1 = makeProfile({ weightKg: 80, bodyFatPct: 15, sex: "female", heightCm: 200 });
    const p2 = makeProfile({ weightKg: 80, bodyFatPct: 15, sex: "male", heightCm: 160 });
    expect(bmr(p1)).toBeCloseTo(bmr(p2), 10);
  });

  it("bodyFatPct null (default) mantiene Mifflin-St Jeor sin cambios", () => {
    const p = makeProfile({ bodyFatPct: null });
    expect(bmr(p)).toBe(1780);
  });
});

describe("targets", () => {
  it("usa manualTdee cuando está presente, ignorando bmr*actividad", () => {
    const p = makeProfile({ manualTdee: 3000, mealsPerDay: 3 });
    const t = targets(p);
    expect(t.tdee).toBe(3000);
  });

  it("calcula TDEE = bmr * factor actividad cuando no hay override", () => {
    const p = makeProfile({ activityLevel: "moderate" }); // bmr=1780
    const t = targets(p);
    expect(t.tdee).toBe(Math.round(1780 * 1.55));
  });

  it("cut reduce kcal diaria al 80% del TDEE", () => {
    const p = makeProfile({ manualTdee: 2000, goal: "cut", mealsPerDay: 4 });
    const t = targets(p);
    expect(t.mealKcal).toBe(Math.round((2000 * 0.8) / 4));
  });

  it("bulk incrementa kcal diaria al 112% del TDEE", () => {
    const p = makeProfile({ manualTdee: 2000, goal: "bulk", mealsPerDay: 4 });
    const t = targets(p);
    expect(t.mealKcal).toBe(Math.round((2000 * 1.12) / 4));
  });

  it("maintain mantiene kcal diaria igual al TDEE", () => {
    const p = makeProfile({ manualTdee: 2000, goal: "maintain", mealsPerDay: 4 });
    const t = targets(p);
    expect(t.mealKcal).toBe(Math.round(2000 / 4));
  });

  it("reparte proteína diaria (peso*g_por_kg) entre comidas", () => {
    const p = makeProfile({ weightKg: 80, proteinGPerKg: 2.0, mealsPerDay: 4 });
    const t = targets(p);
    expect(t.mealProtein).toBe(Math.round((80 * 2.0) / 4));
  });

  it("expone dailyKcal consistente con mealKcal * mealsPerDay (redondeo aparte)", () => {
    const p = makeProfile({ manualTdee: 2000, goal: "cut", mealsPerDay: 4 });
    const t = targets(p);
    expect(t.dailyKcal).toBe(Math.round(2000 * 0.8));
    expect(t.mealKcal).toBe(Math.round(t.dailyKcal / 4));
  });

  it("expone dailyProtein consistente con mealProtein * mealsPerDay (redondeo aparte)", () => {
    const p = makeProfile({ weightKg: 80, proteinGPerKg: 2.0, mealsPerDay: 4 });
    const t = targets(p);
    expect(t.dailyProtein).toBe(Math.round(80 * 2.0));
    expect(t.mealProtein).toBe(Math.round(t.dailyProtein / 4));
  });
});
