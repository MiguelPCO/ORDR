import type { AnalyzeResponse } from "@/schemas";

type Dish = AnalyzeResponse["dishes"][number];

const VERDICT_STYLE: Record<Dish["verdict"], { dot: string; label: string; text: string }> = {
  green: { dot: "bg-green-500", label: "Come esto", text: "text-green-700 dark:text-green-400" },
  amber: { dot: "bg-amber-500", label: "Con matices", text: "text-amber-700 dark:text-amber-400" },
  red: { dot: "bg-red-500", label: "Evita", text: "text-red-700 dark:text-red-400" },
};

function MacroRow({ label, m }: { label: string; m: { kcal: number; protein_g: number; carbs_g: number; fat_g: number } }) {
  return (
    <p className="text-xs text-foreground/60">
      {label}: {Math.round(m.kcal)} kcal · P {Math.round(m.protein_g)}g · C {Math.round(m.carbs_g)}g · G{" "}
      {Math.round(m.fat_g)}g
    </p>
  );
}

export function DishResultCard({ dish }: { dish: Dish }) {
  const style = VERDICT_STYLE[dish.verdict];

  return (
    <div className="dish-card rounded-lg border border-foreground/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} aria-hidden />
          <h3 className="font-medium">{dish.name}</h3>
        </div>
        <span className={`shrink-0 text-xs font-medium ${style.text}`}>
          {style.label} · {dish.fitScore}
        </span>
      </div>
      <p className="mt-1 text-sm text-foreground/70">{dish.reason}</p>
      {dish.conflicts.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-xs text-red-700 dark:text-red-400">
          {dish.conflicts.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-foreground/60">Detalle</summary>
        <div className="mt-2 space-y-1">
          {dish.assumptions && <p className="text-xs text-foreground/60">Supuesto: {dish.assumptions}</p>}
          <MacroRow label="Estimado (LLM)" m={dish.approxMacros} />
          {dish.groundedMacros ? (
            <MacroRow label={`Fundado (confianza: ${dish.groundedMacros.confidence})`} m={dish.groundedMacros} />
          ) : (
            <p className="text-xs text-foreground/60">
              Fundado: no disponible (API de nutrición falló para este plato, usando estimación del LLM).
            </p>
          )}
        </div>
      </details>
    </div>
  );
}
