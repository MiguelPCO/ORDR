import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PROFILE_ROW_SELECT, rowToProfile } from "@/lib/supabase/profile-row";
import { targets } from "@/lib/nutrition/targets";
import { aggregateByDay, type LoggedDish } from "@/lib/log/aggregate";

const RANGE_DAYS = { week: 7, month: 30 } as const;
type Range = keyof typeof RANGE_DAYS;

function isRange(value: string | undefined): value is Range {
  return value === "week" || value === "month";
}

function ProgressBar({ value, target, label }: { value: number; target: number; label: string }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-caption text-ink-soft">
        <span>{label}</span>
        <span className="tabular-nums">
          {Math.round(value)} / {Math.round(target)}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-surface-tint">
        <div className="h-1.5 rounded-full bg-brand-dark" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rawRange } = await searchParams;
  const range: Range = isRange(rawRange) ? rawRange : "week";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // el proxy ya redirige a /login antes de llegar aquí

  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - RANGE_DAYS[range]);
  rangeStart.setUTCHours(0, 0, 0, 0);

  const { data: dishRows } = await supabase
    .from("dishes")
    .select("eaten_at, grounded_macros, approx_macros")
    .not("eaten_at", "is", null)
    .gte("eaten_at", rangeStart.toISOString());

  const loggedDishes: LoggedDish[] = (dishRows ?? []).map((row) => ({
    eatenAt: row.eaten_at as string,
    macros: (row.grounded_macros ??
      row.approx_macros ?? { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }) as LoggedDish["macros"],
  }));

  const days = aggregateByDay(loggedDishes);

  const { data: profileRow } = await supabase
    .from("profiles")
    .select(PROFILE_ROW_SELECT)
    .eq("id", user.id)
    .maybeSingle();
  const dailyTargets = profileRow ? targets(rowToProfile(profileRow)) : null;

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-10">
      <h1 className="text-lg font-semibold">Registro</h1>

      <div className="flex gap-2 text-body-sm">
        <Link
          href="/log?range=week"
          className={`rounded-full px-3 py-1 ${range === "week" ? "bg-brand-dark text-white" : "border border-line text-ink-soft"}`}
        >
          Semana
        </Link>
        <Link
          href="/log?range=month"
          className={`rounded-full px-3 py-1 ${range === "month" ? "bg-brand-dark text-white" : "border border-line text-ink-soft"}`}
        >
          Mes
        </Link>
      </div>

      {days.length === 0 && (
        <p className="text-sm text-foreground/60">
          Aún no has marcado ningún plato como comido — hazlo desde los resultados de un{" "}
          <Link href="/analyze" className="underline">
            análisis
          </Link>
          .
        </p>
      )}

      {!profileRow && days.length > 0 && (
        <p className="rounded-md bg-sem-amber-bg px-3 py-2 text-caption text-sem-amber">
          Completa tu perfil para ver progreso vs objetivo.
        </p>
      )}

      <ul className="space-y-4">
        {days.map((day) => (
          <li key={day.date} className="rounded-lg border border-line bg-surface p-4 space-y-2">
            <p className="text-body-sm font-medium text-ink">
              {new Date(`${day.date}T00:00:00Z`).toLocaleDateString("es-ES", {
                weekday: "long",
                day: "2-digit",
                month: "short",
                timeZone: "UTC",
              })}
            </p>
            {dailyTargets ? (
              <>
                <ProgressBar value={day.kcal} target={dailyTargets.dailyKcal} label="Kcal" />
                <ProgressBar value={day.protein_g} target={dailyTargets.dailyProtein} label="Proteína (g)" />
              </>
            ) : (
              <p className="text-caption text-ink-soft tabular-nums">
                {Math.round(day.kcal)} kcal · P {Math.round(day.protein_g)}g
              </p>
            )}
            <p className="text-caption text-ink-soft tabular-nums">
              Carbos {Math.round(day.carbs_g)}g · Grasa {Math.round(day.fat_g)}g
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
