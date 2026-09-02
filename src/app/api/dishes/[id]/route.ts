import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Toggle: marca eaten_at=now() si estaba null, o lo limpia si ya tenía valor.
// RLS resuelve ownership vía join a `analyses` (dishes no tiene user_id propio) —
// un dish ajeno o inexistente simplemente no aparece en el SELECT/UPDATE, 404.
export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { data: current, error: selectError } = await supabase
    .from("dishes")
    .select("eaten_at")
    .eq("id", id)
    .maybeSingle();

  if (selectError) {
    return NextResponse.json({ error: selectError.message }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: "Plato no encontrado." }, { status: 404 });
  }

  const nextEatenAt = current.eaten_at ? null : new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("dishes")
    .update({ eaten_at: nextEatenAt })
    .eq("id", id)
    .select("eaten_at")
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message ?? "No se pudo actualizar." }, { status: 500 });
  }

  return NextResponse.json({ eatenAt: updated.eaten_at });
}
