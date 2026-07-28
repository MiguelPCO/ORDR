"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { ProfileSchema, type Profile } from "@/schemas";
import { targets } from "@/lib/nutrition/targets";
import { saveProfile } from "@/app/(app)/profile/actions";

type FormValues = {
  displayName: string;
  sex: "male" | "female";
  birthDate: string;
  heightCm: number;
  weightKg: number;
  activityLevel: Profile["activityLevel"];
  diet: Profile["diet"];
  allergies: string;
  goal: Profile["goal"];
  mealsPerDay: number;
  proteinGPerKg: number;
  manualTdee: number | "";
};

function toDefault(profile: Profile | null): FormValues {
  if (!profile) {
    return {
      displayName: "",
      sex: "male",
      birthDate: "",
      heightCm: 175,
      weightKg: 75,
      activityLevel: "moderate",
      diet: "none",
      allergies: "",
      goal: "maintain",
      mealsPerDay: 3,
      proteinGPerKg: 2.0,
      manualTdee: "",
    };
  }
  return {
    displayName: profile.displayName,
    sex: profile.sex,
    birthDate: profile.birthDate.toISOString().slice(0, 10),
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    activityLevel: profile.activityLevel,
    diet: profile.diet,
    allergies: profile.allergies.join(", "),
    goal: profile.goal,
    mealsPerDay: profile.mealsPerDay,
    proteinGPerKg: profile.proteinGPerKg,
    manualTdee: profile.manualTdee ?? "",
  };
}

export function ProfileForm({
  profile,
  onSave,
  submitLabel,
}: {
  profile: Profile | null;
  /** Modo "sesión": si se pasa, no se persiste en Supabase — se entrega el perfil ya parseado
   * (ej. para el flujo anónimo de /analyze, guardado en memoria vía Zustand). */
  onSave?: (profile: Profile) => void;
  submitLabel?: string;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = useForm<FormValues>({ defaultValues: toDefault(profile) });

  function parse(values: FormValues) {
    return ProfileSchema.safeParse({
      ...values,
      displayName: onSave ? values.displayName || "Invitado" : values.displayName,
      allergies: values.allergies.split(",").map((a) => a.trim()).filter(Boolean),
      manualTdee: values.manualTdee === "" ? null : Number(values.manualTdee),
    });
  }

  const watched = watch();
  const preview = (() => {
    const parsed = parse(watched);
    return parsed.success ? targets(parsed.data) : null;
  })();

  const onSubmit = handleSubmit(async (values) => {
    const parsed = parse(values);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setFormError(null);

    if (onSave) {
      onSave(parsed.data);
      return;
    }

    const fd = new FormData();
    fd.set("displayName", values.displayName);
    fd.set("sex", values.sex);
    fd.set("birthDate", values.birthDate);
    fd.set("heightCm", String(values.heightCm));
    fd.set("weightKg", String(values.weightKg));
    fd.set("activityLevel", values.activityLevel);
    fd.set("diet", values.diet);
    fd.set("allergies", values.allergies);
    fd.set("goal", values.goal);
    fd.set("mealsPerDay", String(values.mealsPerDay));
    fd.set("proteinGPerKg", String(values.proteinGPerKg));
    if (values.manualTdee !== "") fd.set("manualTdee", String(values.manualTdee));
    await saveProfile(fd);
  });

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-lg space-y-6 px-4 py-10">
      {!onSave && (
        <div className="space-y-1">
          <label htmlFor="displayName" className="text-sm font-medium">
            Nombre
          </label>
          <input
            id="displayName"
            className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            {...register("displayName")}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="sex" className="text-sm font-medium">
            Sexo
          </label>
          <select
            id="sex"
            className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            {...register("sex")}
          >
            <option value="male">Hombre</option>
            <option value="female">Mujer</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="birthDate" className="text-sm font-medium">
            Nacimiento
          </label>
          <input
            id="birthDate"
            type="date"
            className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            {...register("birthDate")}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="heightCm" className="text-sm font-medium">
            Altura (cm)
          </label>
          <input
            id="heightCm"
            type="number"
            className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            {...register("heightCm", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="weightKg" className="text-sm font-medium">
            Peso (kg)
          </label>
          <input
            id="weightKg"
            type="number"
            className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            {...register("weightKg", { valueAsNumber: true })}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="activityLevel" className="text-sm font-medium">
          Actividad
        </label>
        <select
          id="activityLevel"
          className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          {...register("activityLevel")}
        >
          <option value="sedentary">Sedentario</option>
          <option value="light">Ligera</option>
          <option value="moderate">Moderada</option>
          <option value="active">Activa</option>
          <option value="very_active">Muy activa</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="diet" className="text-sm font-medium">
            Dieta
          </label>
          <select
            id="diet"
            className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            {...register("diet")}
          >
            <option value="none">Ninguna</option>
            <option value="vegan">Vegana</option>
            <option value="vegetarian">Vegetariana</option>
            <option value="keto">Keto</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="goal" className="text-sm font-medium">
            Objetivo
          </label>
          <select
            id="goal"
            className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            {...register("goal")}
          >
            <option value="cut">Definición</option>
            <option value="maintain">Mantenimiento</option>
            <option value="bulk">Volumen</option>
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="allergies" className="text-sm font-medium">
          Alergias (separadas por coma)
        </label>
        <input
          id="allergies"
          className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          {...register("allergies")}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <label htmlFor="mealsPerDay" className="text-sm font-medium">
            Comidas/día
          </label>
          <input
            id="mealsPerDay"
            type="number"
            className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            {...register("mealsPerDay", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="proteinGPerKg" className="text-sm font-medium">
            g prot/kg
          </label>
          <input
            id="proteinGPerKg"
            type="number"
            step="0.1"
            className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            {...register("proteinGPerKg", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="manualTdee" className="text-sm font-medium">
            TDEE manual
          </label>
          <input
            id="manualTdee"
            type="number"
            placeholder="opcional"
            className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            {...register("manualTdee")}
          />
        </div>
      </div>

      {formError && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {formError}
        </p>
      )}

      {preview && (
        <div className="rounded-md border border-brand-dark/20 bg-brand-soft px-4 py-3 text-sm">
          <p className="font-medium text-brand-on-soft">Target calculado</p>
          <p className="text-foreground/70">
            TDEE {preview.tdee} kcal · por comida: {preview.mealKcal} kcal / {preview.mealProtein}g
            proteína
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-brand-dark px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-darker disabled:opacity-50"
      >
        {isSubmitting ? "Guardando…" : (submitLabel ?? "Guardar perfil")}
      </button>
    </form>
  );
}
