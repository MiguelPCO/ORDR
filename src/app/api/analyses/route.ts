import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AnalysisSummarySchema } from "@/schemas";

// SCHEMA.md §8 — historial (D4). RLS ya filtra por user_id; el .eq() es defensa explícita.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("analyses")
    .select("id, created_at, source_type, status, notes, goal_snapshot, dishes(id)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const analyses = (data ?? []).map((row) =>
    AnalysisSummarySchema.parse({
      id: row.id,
      createdAt: row.created_at,
      sourceType: row.source_type,
      status: row.status,
      notes: row.notes,
      goalSnapshot: row.goal_snapshot,
      dishCount: Array.isArray(row.dishes) ? row.dishes.length : 0,
    })
  );

  return NextResponse.json({ analyses });
}
