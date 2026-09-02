import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const FeedbackRequestSchema = z.object({ agree: z.boolean() });

// RLS resuelve ownership vía join a `analyses` (dishes no tiene user_id propio) —
// un dish ajeno o inexistente simplemente no aparece en el UPDATE, 404.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const parsed = FeedbackRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("dishes")
    .update({ verdict_feedback: parsed.data.agree })
    .eq("id", id)
    .select("verdict_feedback")
    .maybeSingle();

  if (updateError) {
    console.error("PATCH /api/dishes/[id]/feedback: fallo al actualizar el plato", updateError);
    return NextResponse.json({ error: "No se pudo guardar el feedback." }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: "Plato no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ verdictFeedback: updated.verdict_feedback });
}
