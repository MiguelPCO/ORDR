import type { AnalyzeResponse, Verdict } from "@/schemas";

export type VerdictFilter = "all" | Verdict;

const FILTER_LABEL: Record<VerdictFilter, string> = {
  all: "Todos",
  green: "Verde",
  amber: "Ámbar",
  red: "Rojo",
};

const FILTERS: VerdictFilter[] = ["all", "green", "amber", "red"];

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
      {FILTERS.map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => onChange(f)}
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            value === f
              ? "border-brand-dark bg-brand-soft text-brand-on-soft"
              : "border-foreground/15 text-foreground/60"
          }`}
        >
          {FILTER_LABEL[f]} ({counts[f]})
        </button>
      ))}
    </div>
  );
}
