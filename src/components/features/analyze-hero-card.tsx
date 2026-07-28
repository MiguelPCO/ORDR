import type { AnalyzeResponse, Verdict } from "@/schemas";

const VERDICT_BAR_COLOR: Record<Verdict, string> = {
  green: "bg-green-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

export function AnalyzeHeroCard({ dishes }: { dishes: AnalyzeResponse["dishes"] }) {
  const counts: Record<Verdict, number> = { green: 0, amber: 0, red: 0 };
  for (const d of dishes) counts[d.verdict]++;
  const total = dishes.length || 1;

  return (
    <div className="rounded-lg border border-foreground/10 p-4">
      <p className="text-2xl font-semibold">
        {dishes.length} plato{dishes.length === 1 ? "" : "s"} analizados
      </p>
      <p className="text-sm text-foreground/60">{counts.green} en verde</p>
      <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-foreground/10">
        {(["green", "amber", "red"] as const).map((v) =>
          counts[v] > 0 ? (
            <div
              key={v}
              className={VERDICT_BAR_COLOR[v]}
              style={{ width: `${(counts[v] / total) * 100}%` }}
            />
          ) : null
        )}
      </div>
    </div>
  );
}
