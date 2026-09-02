import { describe, it, expect } from "vitest";
import { aggregateByDay } from "./aggregate";

const macros = (overrides: Partial<{ kcal: number; protein_g: number; carbs_g: number; fat_g: number }> = {}) => ({
  kcal: 500,
  protein_g: 30,
  carbs_g: 40,
  fat_g: 15,
  ...overrides,
});

describe("aggregateByDay", () => {
  it("array vacío devuelve array vacío", () => {
    expect(aggregateByDay([])).toEqual([]);
  });

  it("suma varios dishes del mismo día", () => {
    const result = aggregateByDay([
      { eatenAt: "2026-09-01T09:00:00.000Z", macros: macros({ kcal: 500, protein_g: 30 }) },
      { eatenAt: "2026-09-01T20:00:00.000Z", macros: macros({ kcal: 700, protein_g: 40 }) },
    ]);
    expect(result).toEqual([
      { date: "2026-09-01", kcal: 1200, protein_g: 70, carbs_g: 80, fat_g: 30 },
    ]);
  });

  it("no mezcla días distintos", () => {
    const result = aggregateByDay([
      { eatenAt: "2026-09-01T09:00:00.000Z", macros: macros({ kcal: 500 }) },
      { eatenAt: "2026-09-02T09:00:00.000Z", macros: macros({ kcal: 700 }) },
    ]);
    expect(result.map((d) => d.date)).toEqual(["2026-09-02", "2026-09-01"]);
  });

  it("ordena descendente por fecha (día más reciente primero)", () => {
    const result = aggregateByDay([
      { eatenAt: "2026-08-30T09:00:00.000Z", macros: macros() },
      { eatenAt: "2026-09-01T09:00:00.000Z", macros: macros() },
      { eatenAt: "2026-08-31T09:00:00.000Z", macros: macros() },
    ]);
    expect(result.map((d) => d.date)).toEqual(["2026-09-01", "2026-08-31", "2026-08-30"]);
  });
});
