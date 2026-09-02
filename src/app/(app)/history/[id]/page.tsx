import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DISH_ROW_SELECT, rowToDish } from "@/lib/supabase/dish-row";
import { HistoryDishList } from "@/components/features/history-dish-list";

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // el proxy ya redirige a /login antes de llegar aquí

  const { data: analysis } = await supabase
    .from("analyses")
    .select("id, created_at, source_type, notes")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!analysis) notFound();

  const { data: dishRows } = await supabase
    .from("dishes")
    .select(DISH_ROW_SELECT)
    .eq("analysis_id", id)
    .order("rank", { ascending: true });

  const dishes = (dishRows ?? []).map(rowToDish);

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">
          {new Date(analysis.created_at).toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}{" "}
          · {dishes.length} plato{dishes.length === 1 ? "" : "s"}
        </h1>
        <Link href="/history" className="text-sm text-foreground/60 underline underline-offset-2">
          Volver
        </Link>
      </div>
      {analysis.notes && <p className="text-sm text-foreground/60">{analysis.notes}</p>}
      <HistoryDishList initialDishes={dishes} />
    </main>
  );
}
