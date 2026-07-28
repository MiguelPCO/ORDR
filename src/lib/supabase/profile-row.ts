import type { Profile } from "@/schemas";

export type ProfileRow = {
  display_name: string;
  sex: string;
  birth_date: string;
  height_cm: number;
  weight_kg: number;
  activity_level: string;
  diet: string;
  allergies: string[];
  dislikes: string[];
  goal: string;
  meals_per_day: number;
  protein_g_per_kg: number;
  manual_tdee: number | null;
  fat_limit_g: number | null;
  carb_limit_g: number | null;
};

export const PROFILE_ROW_SELECT =
  "display_name, sex, birth_date, height_cm, weight_kg, activity_level, diet, allergies, dislikes, goal, meals_per_day, protein_g_per_kg, manual_tdee, fat_limit_g, carb_limit_g";

export function rowToProfile(row: ProfileRow): Profile {
  return {
    displayName: row.display_name,
    sex: row.sex as Profile["sex"],
    birthDate: new Date(row.birth_date),
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    activityLevel: row.activity_level as Profile["activityLevel"],
    diet: row.diet as Profile["diet"],
    allergies: row.allergies,
    dislikes: row.dislikes,
    goal: row.goal as Profile["goal"],
    mealsPerDay: row.meals_per_day,
    proteinGPerKg: row.protein_g_per_kg,
    manualTdee: row.manual_tdee,
    fatLimitG: row.fat_limit_g,
    carbLimitG: row.carb_limit_g,
  };
}
