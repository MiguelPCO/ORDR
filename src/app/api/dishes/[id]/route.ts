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
    .select("eaten_at, analysis_id")
    .eq("id", id)
    .maybeSingle();

  if (selectError) {
    console.error("PATCH /api/dishes/[id]: fallo al consultar el plato", selectError);
    return NextResponse.json({ error: "No se pudo consultar el plato." }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: "Plato no encontrado." }, { status: 404 });
  }

  const nextEatenAt = current.eaten_at ? null : new Date().toISOString();

  // No hay transacción disponible sin RPC (Supabase JS no la da) — no atómico, mismo
  // riesgo aceptado que el resto de este archivo (SELECT-then-UPDATE). Al marcar
  // (nextEatenAt no null), limpiamos primero cualquier otro plato del mismo análisis
  // para que el índice único parcial (dishes_one_eaten_per_analysis) nunca se viole en
  // ningún paso intermedio: varios `null` es válido, dos `no-null` a la vez no lo es.
  if (nextEatenAt) {
    const { error: clearSiblingsError } = await supabase
      .from("dishes")
      .update({ eaten_at: null })
      .eq("analysis_id", current.analysis_id);

    if (clearSiblingsError) {
      console.error("PATCH /api/dishes/[id]: fallo al limpiar el plato previo", clearSiblingsError);
      return NextResponse.json({ error: "No se pudo actualizar el plato." }, { status: 500 });
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from("dishes")
    .update({ eaten_at: nextEatenAt })
    .eq("id", id)
    .select("eaten_at")
    .maybeSingle();

  if (updateError || !updated) {
    console.error("PATCH /api/dishes/[id]: fallo al actualizar el plato", updateError);
    return NextResponse.json({ error: "No se pudo actualizar el plato." }, { status: 500 });
  }

  return NextResponse.json({ eatenAt: updated.eaten_at });
}
