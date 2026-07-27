import type { Profile } from "@/schemas";

const ACT: Record<Profile["activityLevel"], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_MULT: Record<Profile["goal"], number> = {
  cut: 0.8,
  maintain: 1.0,
  bulk: 1.12,
};

function yearsSince(date: Date): number {
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const hasHadBirthdayThisYear =
    now.getMonth() > date.getMonth() ||
    (now.getMonth() === date.getMonth() && now.getDate() >= date.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

// SCHEMA.md §6
export function bmr(p: Profile): number {
  const age = yearsSince(p.birthDate);
  const s = p.sex === "male" ? 5 : -161;
  return 10 * p.weightKg + 6.25 * p.heightCm - 5 * age + s;
}

export function targets(p: Profile) {
  const tdee = p.manualTdee ?? Math.round(bmr(p) * ACT[p.activityLevel]);
  const dailyKcal = Math.round(tdee * GOAL_MULT[p.goal]);
  const dailyProtein = Math.round(p.weightKg * p.proteinGPerKg);
  return {
    tdee,
    mealKcal: Math.round(dailyKcal / p.mealsPerDay),
    mealProtein: Math.round(dailyProtein / p.mealsPerDay),
  };
}
