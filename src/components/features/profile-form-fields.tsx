import type { UseFormRegister } from "react-hook-form";
import type { FormValues } from "@/components/features/profile-form";

const inputClass = "w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm";

export function NutritionTargetFields({ register }: { register: UseFormRegister<FormValues> }) {
  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <label htmlFor="mealsPerDay" className="text-sm font-medium">
            Comidas/día
          </label>
          <input
            id="mealsPerDay"
            type="number"
            className={inputClass}
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
            className={inputClass}
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
            className={inputClass}
            {...register("manualTdee")}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="bodyFatPct" className="text-sm font-medium">
          % grasa corporal
        </label>
        <input
          id="bodyFatPct"
          type="number"
          step="0.1"
          placeholder="opcional, mejora precisión (Katch-McArdle)"
          className={inputClass}
          {...register("bodyFatPct")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="fatLimitG" className="text-sm font-medium">
            Límite grasa (g/comida)
          </label>
          <input
            id="fatLimitG"
            type="number"
            placeholder="sin límite"
            className={inputClass}
            {...register("fatLimitG")}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="carbLimitG" className="text-sm font-medium">
            Límite carbos (g/comida)
          </label>
          <input
            id="carbLimitG"
            type="number"
            placeholder="sin límite"
            className={inputClass}
            {...register("carbLimitG")}
          />
        </div>
      </div>
    </>
  );
}
