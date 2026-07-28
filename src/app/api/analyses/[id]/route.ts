import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AnalysisDetailSchema } from "@/schemas";
import { DISH_ROW_SELECT, rowToDish } from "@/lib/supabase/dish-row";

// SCHEMA.md §8 — detalle de un análisis pasado (D4). RLS filtra por dueño vía join a `analyses`.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { data: analysis, error: analysisError } = await supabase
    .from("analyses")
    .select("id, created_at, source_type, status, notes, goal_snapshot")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (analysisError) {
    return NextResponse.json({ error: analysisError.message }, { status: 500 });
  }
  if (!analysis) {
    return NextResponse.json({ error: "Análisis no encontrado." }, { status: 404 });
  }

  const { data: dishRows, error: dishesError } = await supabase
    .from("dishes")
    .select(DISH_ROW_SELECT)
    .eq("analysis_id", id)
    .order("rank", { ascending: true });

  if (dishesError) {
    return NextResponse.json({ error: dishesError.message }, { status: 500 });
  }

  const detail = AnalysisDetailSchema.parse({
    id: analysis.id,
    createdAt: analysis.created_at,
    sourceType: analysis.source_type,
    status: analysis.status,
    notes: analysis.notes,
    goalSnapshot: analysis.goal_snapshot,
    dishCount: dishRows?.length ?? 0,
    dishes: (dishRows ?? []).map(rowToDish),
  });

  return NextResponse.json(detail);
}
