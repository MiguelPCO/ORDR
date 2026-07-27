import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/features/profile-form";
import type { Profile } from "@/schemas";

function rowToProfile(row: {
  display_name: string;
  sex: string;
  birth_date: string;
  height_cm: number;
  weight_kg: number;
  activity_level: string;
  diet: string;
  allergies: string[];
  goal: string;
  meals_per_day: number;
  protein_g_per_kg: number;
  manual_tdee: number | null;
}): Profile {
  return {
    displayName: row.display_name,
    sex: row.sex as Profile["sex"],
    birthDate: new Date(row.birth_date),
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    activityLevel: row.activity_level as Profile["activityLevel"],
    diet: row.diet as Profile["diet"],
    allergies: row.allergies,
    goal: row.goal as Profile["goal"],
    mealsPerDay: row.meals_per_day,
    proteinGPerKg: row.protein_g_per_kg,
    manualTdee: row.manual_tdee,
  };
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: row } = await supabase
    .from("profiles")
    .select(
      "display_name, sex, birth_date, height_cm, weight_kg, activity_level, diet, allergies, goal, meals_per_day, protein_g_per_kg, manual_tdee"
    )
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div>
      {params.saved && (
        <p className="mx-auto mt-6 max-w-lg rounded-md bg-green-500/10 px-3 py-2 text-center text-sm text-green-700 dark:text-green-400">
          Perfil guardado.
        </p>
      )}
      {params.error && (
        <p className="mx-auto mt-6 max-w-lg rounded-md bg-red-500/10 px-3 py-2 text-center text-sm text-red-700 dark:text-red-400">
          {params.error}
        </p>
      )}
      <ProfileForm profile={row ? rowToProfile(row) : null} />
    </div>
  );
}
