import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // el proxy ya redirige a /login antes de llegar aquí

  const { data } = await supabase
    .from("analyses")
    .select("id, created_at, source_type, status, dishes(id, final_verdict)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const analyses = data ?? [];

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-10">
      <h1 className="text-lg font-semibold">Historial</h1>

      {analyses.length === 0 && (
        <p className="text-sm text-foreground/60">
          Todavía no has analizado ninguna carta.{" "}
          <Link href="/analyze" className="underline">
            Analizar una
          </Link>
          .
        </p>
      )}

      <ul className="space-y-2">
        {analyses.map((a) => {
          const dishes: { final_verdict: string }[] = Array.isArray(a.dishes) ? a.dishes : [];
          const green = dishes.filter((d) => d.final_verdict === "green").length;
          return (
            <li key={a.id}>
              <Link
                href={`/history/${a.id}`}
                className="flex items-center justify-between rounded-lg border border-foreground/10 px-4 py-3 hover:bg-foreground/5"
              >
                <span>
                  {new Date(a.created_at).toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}{" "}
                  · {dishes.length} plato{dishes.length === 1 ? "" : "s"} · {a.source_type}
                </span>
                <span className="text-sm text-foreground/60">{green} en verde</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
