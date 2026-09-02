import type { AnalyzeResponse } from "@/schemas";
import { Ring } from "@/components/features/score-ring";

type Dish = AnalyzeResponse["dishes"][number];

const VERDICT_STYLE: Record<Dish["verdict"], { label: string; text: string; bg: string; band: string; ring: string }> = {
  green: {
    label: "Come esto",
    text: "text-sem-green",
    bg: "bg-sem-green-bg",
    band: "bg-sem-green",
    ring: "var(--color-sem-green)",
  },
  amber: {
    label: "Con matices",
    text: "text-sem-amber",
    bg: "bg-sem-amber-bg",
    band: "bg-sem-amber",
    ring: "var(--color-sem-amber)",
  },
  red: {
    label: "Evita",
    text: "text-sem-red",
    bg: "bg-sem-red-bg",
    band: "bg-sem-red",
    ring: "var(--color-sem-red)",
  },
};

function MacroRow({ label, m }: { label: string; m: { kcal: number; protein_g: number; carbs_g: number; fat_g: number } }) {
  return (
    <p className="text-caption text-ink-soft tabular-nums">
      {label}: {Math.round(m.kcal)} kcal · P {Math.round(m.protein_g)}g · C {Math.round(m.carbs_g)}g · G{" "}
      {Math.round(m.fat_g)}g
    </p>
  );
}

function MacroChips({ m }: { m: { kcal: number; protein_g: number; carbs_g: number; fat_g: number } }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5 text-caption text-ink-soft tabular-nums">
      <span className="rounded-full bg-surface-tint px-2 py-0.5">{Math.round(m.kcal)} kcal</span>
      <span className="rounded-full bg-surface-tint px-2 py-0.5">P {Math.round(m.protein_g)}g</span>
      <span className="rounded-full bg-surface-tint px-2 py-0.5">C {Math.round(m.carbs_g)}g</span>
      <span className="rounded-full bg-surface-tint px-2 py-0.5">G {Math.round(m.fat_g)}g</span>
    </div>
  );
}

export function DishResultCard({
  dish,
  onToggleEaten,
  disabled,
}: {
  dish: Dish;
  onToggleEaten?: (dishId: string) => void;
  disabled?: boolean;
}) {
  const style = VERDICT_STYLE[dish.verdict];
  const primaryMacros = dish.groundedMacros ?? dish.approxMacros;
  const isEaten = dish.eatenAt !== null;

  return (
    <div className="dish-card relative overflow-hidden rounded-lg border border-line bg-surface p-4 pl-5">
      <span className={`absolute inset-y-0 left-0 w-1 ${style.band}`} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Ring segments={[{ value: dish.fitScore, colorVar: style.ring }]} size={28} strokeWidth={3} total={100} />
          <h3 className="font-display text-card-title font-semibold text-ink">{dish.name}</h3>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-caption font-medium ${style.bg} ${style.text}`}>
          {style.label}
        </span>
      </div>
      <p className="mt-1 text-body-sm text-ink-soft">{dish.reason}</p>
      <MacroChips m={primaryMacros} />
      {dish.conflicts.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-caption text-sem-red">
          {dish.conflicts.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}

      {onToggleEaten && dish.id && (
        <button
          type="button"
          onClick={() => onToggleEaten(dish.id!)}
          disabled={disabled}
          className={`mt-3 w-full rounded-md px-3 py-2 text-body-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isEaten
              ? "bg-sem-green-bg text-sem-green"
              : "border border-brand-dark/50 text-brand-dark hover:bg-brand-soft"
          }`}
        >
          {isEaten ? "Comido ✓" : "Comí esto"}
        </button>
      )}

      <details className="mt-3 text-body-sm">
        <summary className="cursor-pointer text-ink-soft">Detalle</summary>
        <div className="mt-2 space-y-1">
          {dish.assumptions && <p className="text-caption text-ink-soft">Supuesto: {dish.assumptions}</p>}
          <MacroRow label="Estimado (LLM)" m={dish.approxMacros} />
          {dish.groundedMacros ? (
            <MacroRow label={`Fundado (confianza: ${dish.groundedMacros.confidence})`} m={dish.groundedMacros} />
          ) : (
            <p className="text-caption text-ink-soft">
              Fundado: no disponible (API de nutrición falló para este plato, usando estimación del LLM).
            </p>
          )}
        </div>
      </details>
    </div>
  );
}
