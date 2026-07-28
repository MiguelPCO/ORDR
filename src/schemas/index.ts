import { z } from "zod";

// SCHEMA.md §2 — Enums compartidos
export const Goal = z.enum(["cut", "bulk", "maintain"]);
export const Diet = z.enum(["none", "vegan", "vegetarian", "keto"]);
export const Activity = z.enum(["sedentary", "light", "moderate", "active", "very_active"]);
export const Verdict = z.enum(["green", "amber", "red"]);

export type Goal = z.infer<typeof Goal>;
export type Diet = z.infer<typeof Diet>;
export type Activity = z.infer<typeof Activity>;
export type Verdict = z.infer<typeof Verdict>;

// SCHEMA.md §3 — Perfil
export const ProfileSchema = z.object({
  displayName: z.string().min(1),
  sex: z.enum(["male", "female"]),
  birthDate: z.coerce.date(),
  heightCm: z.number().min(120).max(230),
  weightKg: z.number().min(35).max(250),
  activityLevel: Activity,
  diet: Diet,
  allergies: z.array(z.string()).default([]),
  goal: Goal,
  mealsPerDay: z.number().int().min(1).max(6).default(3),
  proteinGPerKg: z.number().min(1).max(3.5).default(2.0),
  manualTdee: z.number().int().positive().nullable().default(null),
});
export type Profile = z.infer<typeof ProfileSchema>;

// SCHEMA.md §4 — Contrato de salida del LLM
export const MacrosSchema = z.object({
  kcal: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
});

export const LlmDishSchema = z.object({
  name: z.string(),
  verdict: Verdict.or(z.enum(["verde", "ambar", "rojo"])), // tolera ES; se normaliza
  reason: z.string(),
  nutrition_query: z.string(),
  approx: MacrosSchema,
  assumptions: z.string().default(""),
  conflicts: z.array(z.string()).default([]),
});

export const LlmResponseSchema = z.object({
  menu_read_ok: z.boolean(),
  dishes: z.array(LlmDishSchema),
  notes: z.string().optional(),
});

// SCHEMA.md §5 — Mapeo API Ninjas / CalorieNinjas
export const GroundedMacrosSchema = z.object({
  kcal: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
  confidence: z.enum(["high", "medium", "low"]),
  breakdown: z.array(
    z.object({
      item: z.string(),
      kcal: z.number(),
      protein_g: z.number(),
      carbs_g: z.number(),
      fat_g: z.number(),
    })
  ),
});

// SCHEMA.md §8 — Contratos de API
export const AnalyzeRequestSchema = z.object({
  goal: Goal,
  profileSnapshot: z.object({
    mealKcal: z.number(),
    mealProtein: z.number(),
    diet: Diet,
    allergies: z.array(z.string()),
  }),
});

export const AnalyzedDishSchema = z.object({
  name: z.string(),
  reason: z.string(),
  nutritionQuery: z.string(),
  assumptions: z.string(),
  conflicts: z.array(z.string()),
  approxMacros: MacrosSchema,
  groundedMacros: GroundedMacrosSchema.nullable(),
  verdict: Verdict,
  fitScore: z.number(),
});
export type AnalyzedDish = z.infer<typeof AnalyzedDishSchema>;

export const AnalyzeResponseSchema = z.object({
  analysisId: z.string().nullable(),
  menuReadOk: z.boolean(),
  notes: z.string().optional(),
  dishes: z.array(AnalyzedDishSchema),
});
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;

// Historial (D4) — SCHEMA.md §8, GET /api/analyses · GET /api/analyses/:id
export const AnalysisSummarySchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  sourceType: z.enum(["image", "pdf", "url"]),
  status: z.enum(["processing", "done", "error"]),
  notes: z.string().nullable(),
  goalSnapshot: z.record(z.string(), z.unknown()),
  dishCount: z.number(),
});
export type AnalysisSummary = z.infer<typeof AnalysisSummarySchema>;

export const AnalysisDetailSchema = AnalysisSummarySchema.extend({
  dishes: z.array(AnalyzedDishSchema),
});
export type AnalysisDetail = z.infer<typeof AnalysisDetailSchema>;
