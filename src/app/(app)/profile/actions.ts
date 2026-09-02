"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileSchema } from "@/schemas";

export async function saveProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const parsed = ProfileSchema.safeParse({
    displayName: formData.get("displayName"),
    sex: formData.get("sex"),
    birthDate: formData.get("birthDate"),
    heightCm: Number(formData.get("heightCm")),
    weightKg: Number(formData.get("weightKg")),
    activityLevel: formData.get("activityLevel"),
    diet: formData.get("diet"),
    allergies: String(formData.get("allergies") ?? "")
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean),
    dislikes: String(formData.get("dislikes") ?? "")
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean),
    goal: formData.get("goal"),
    mealsPerDay: Number(formData.get("mealsPerDay")),
    proteinGPerKg: Number(formData.get("proteinGPerKg")),
    manualTdee: formData.get("manualTdee") ? Number(formData.get("manualTdee")) : null,
    bodyFatPct: formData.get("bodyFatPct") ? Number(formData.get("bodyFatPct")) : null,
    fatLimitG: formData.get("fatLimitG") ? Number(formData.get("fatLimitG")) : null,
    carbLimitG: formData.get("carbLimitG") ? Number(formData.get("carbLimitG")) : null,
  });

  if (!parsed.success) {
    redirect(`/profile?error=${encodeURIComponent(parsed.error.message)}`);
  }

  const p = parsed.data;
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    display_name: p.displayName,
    sex: p.sex,
    birth_date: p.birthDate.toISOString().slice(0, 10),
    height_cm: p.heightCm,
    weight_kg: p.weightKg,
    activity_level: p.activityLevel,
    diet: p.diet,
    allergies: p.allergies,
    dislikes: p.dislikes,
    goal: p.goal,
    meals_per_day: p.mealsPerDay,
    protein_g_per_kg: p.proteinGPerKg,
    manual_tdee: p.manualTdee,
    body_fat_pct: p.bodyFatPct,
    fat_limit_g: p.fatLimitG,
    carb_limit_g: p.carbLimitG,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    redirect(`/profile?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/profile?saved=1");
}
