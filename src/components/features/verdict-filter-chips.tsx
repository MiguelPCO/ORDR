import type { AnalyzeResponse, Verdict } from "@/schemas";

export type VerdictFilter = "all" | Verdict;

const FILTER_LABEL: Record<VerdictFilter, string> = {
  all: "Todos",
  green: "Verde",
  amber: "Ámbar",
  red: "Rojo",
};

const FILTERS: VerdictFilter[] = ["all", "green", "amber", "red"];

const CHIP_STYLE: Record<VerdictFilter, { bg: string; text: string }> = {
  all: { bg: "bg-surface-tint", text: "text-ink-soft" },
  green: { bg: "bg-sem-green-bg", text: "text-sem-green" },
  amber: { bg: "bg-sem-amber-bg", text: "text-sem-amber" },
  red: { bg: "bg-sem-red-bg", text: "text-sem-red" },
};

export function VerdictFilterChips({
  dishes,
  value,
  onChange,
}: {
  dishes: AnalyzeResponse["dishes"];
  value: VerdictFilter;
  onChange: (v: VerdictFilter) => void;
}) {
  const counts: Record<VerdictFilter, number> = {
    all: dishes.length,
    green: dishes.filter((d) => d.verdict === "green").length,
    amber: dishes.filter((d) => d.verdict === "amber").length,
    red: dishes.filter((d) => d.verdict === "red").length,
  };

  return (
    <div className="flex gap-2 overflow-x-auto">
      {FILTERS.map((f) => {
        const style = CHIP_STYLE[f];
        return (
          <button
            key={f}
            type="button"
            onClick={() => onChange(f)}
            className={`shrink-0 rounded-full border-2 px-3 py-1 text-caption font-medium transition-colors ${style.bg} ${style.text} ${
              value === f ? "border-current" : "border-transparent"
            }`}
          >
            {FILTER_LABEL[f]} (<span className="font-bold">{counts[f]}</span>)
          </button>
        );
      })}
    </div>
  );
}
