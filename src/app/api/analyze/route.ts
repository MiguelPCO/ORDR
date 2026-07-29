import { NextRequest, NextResponse } from "next/server";
import { AnalyzeRequestSchema, AnalyzeResponseSchema, Verdict } from "@/schemas";
import { readMenu, type MenuImageInput } from "@/lib/llm/read-menu";
import { groundMacrosBatch } from "@/lib/nutrition/api-ninjas";
import { scoreDish, hardLimitReasons, normalizeVerdict, type Target } from "@/lib/nutrition/scoring";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_MEDIA_TYPES = new Set<MenuImageInput["mediaType"]>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const VERDICT_RANK: Record<Verdict, number> = { green: 0, amber: 1, red: 2 };

export async function POST(request: NextRequest) {
  const formData = await request.formData();

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length < 1 || files.length > 4) {
    return NextResponse.json(
      { error: "Sube entre 1 y 4 archivos (imagen o PDF)." },
      { status: 400 }
    );
  }
  for (const f of files) {
    if (!ALLOWED_MEDIA_TYPES.has(f.type as MenuImageInput["mediaType"])) {
      return NextResponse.json(
        { error: `Tipo de archivo no soportado: ${f.type || "desconocido"}` },
        { status: 400 }
      );
    }
  }

  const rawPayload = formData.get("payload");
  let parsedPayload;
  try {
    parsedPayload = AnalyzeRequestSchema.safeParse(JSON.parse(String(rawPayload ?? "")));
  } catch {
    return NextResponse.json({ error: "payload no es JSON válido." }, { status: 400 });
  }
  if (!parsedPayload.success) {
    return NextResponse.json(
      { error: `payload inválido: ${parsedPayload.error.message}` },
      { status: 400 }
    );
  }
  const { goal, profileSnapshot } = parsedPayload.data;

  const images: MenuImageInput[] = await Promise.all(
    files.map(async (f) => ({
      base64: Buffer.from(await f.arrayBuffer()).toString("base64"),
      mediaType: f.type as MenuImageInput["mediaType"],
    }))
  );

  let llmResult;
  try {
    llmResult = await readMenu(images, {
      diet: profileSnapshot.diet,
      allergies: [...profileSnapshot.allergies, ...profileSnapshot.allergiesExtra],
      dislikes: [...profileSnapshot.dislikes, ...profileSnapshot.dislikesExtra],
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  if (!llmResult.menu_read_ok || llmResult.dishes.length === 0) {
    return NextResponse.json(
      AnalyzeResponseSchema.parse({
        analysisId: null,
        menuReadOk: llmResult.menu_read_ok,
        notes: llmResult.notes,
        dishes: [],
      })
    );
  }

  // Fundamentado de macros en paralelo (con límite, R4) — SCHEMA §8 paso 2.
  const grounded = await groundMacrosBatch(llmResult.dishes.map((d) => d.nutrition_query));

  const target: Target = {
    mealKcal: profileSnapshot.mealKcal,
    mealProtein: profileSnapshot.mealProtein,
  };

  const scoredDishes = llmResult.dishes.map((dish, i) => {
    const groundedMacros = grounded[i];
    const limitReasons = hardLimitReasons(
      groundedMacros,
      profileSnapshot.diet,
      profileSnapshot.fatLimitG,
      profileSnapshot.carbLimitG
    );
    const conflicts = [...dish.conflicts, ...limitReasons];
    const hardRed = conflicts.length > 0;
    const macrosForScoring = groundedMacros ?? dish.approx;
    const { verdict: engineVerdict, fitScore } = scoreDish(macrosForScoring, target, goal, hardRed);

    // Si API Ninjas falló para este plato, el veredicto de texto cae al borrador del LLM
    // (PRD §7: "llm_draft_verdict solo sirve de fallback si API Ninjas falla"); el fitScore
    // numérico lo sigue calculando el motor a partir del approx del LLM, para poder ordenar.
    const verdict: Verdict = hardRed
      ? "red"
      : groundedMacros
        ? engineVerdict
        : normalizeVerdict(dish.verdict);

    return {
      name: dish.name,
      reason: dish.reason,
      nutritionQuery: dish.nutrition_query,
      assumptions: dish.assumptions,
      conflicts,
      approxMacros: dish.approx,
      groundedMacros,
      verdict,
      fitScore,
      llmDraftVerdict: normalizeVerdict(dish.verdict),
    };
  });

  scoredDishes.sort((a, b) => {
    const rankDiff = VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict];
    return rankDiff !== 0 ? rankDiff : b.fitScore - a.fitScore;
  });

  const analysisId = await persistIfAuthenticated({
    goal,
    profileSnapshot,
    files,
    notes: llmResult.notes,
    dishes: scoredDishes,
  });

  return NextResponse.json(
    AnalyzeResponseSchema.parse({
      analysisId,
      menuReadOk: true,
      notes: llmResult.notes,
      dishes: scoredDishes,
    })
  );
}

type ScoredDish = {
  name: string;
  reason: string;
  nutritionQuery: string;
  assumptions: string;
  conflicts: string[];
  approxMacros: { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
  groundedMacros: Awaited<ReturnType<typeof groundMacrosBatch>>[number];
  verdict: Verdict;
  fitScore: number;
  llmDraftVerdict: Verdict;
};

/** Persistencia condicional (D1): anónimo = solo en memoria, nunca escribe filas. */
async function persistIfAuthenticated(input: {
  goal: string;
  profileSnapshot: { mealKcal: number; mealProtein: number; diet: string; allergies: string[] };
  files: File[];
  notes: string | undefined;
  dishes: ScoredDish[];
}): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const sourceType = input.files.some((f) => f.type === "application/pdf") ? "pdf" : "image";

    const { data: analysis, error: analysisError } = await supabase
      .from("analyses")
      .insert({
        user_id: user.id,
        goal_snapshot: { goal: input.goal, ...input.profileSnapshot },
        source_type: sourceType,
        source_meta: { fileNames: input.files.map((f) => f.name) },
        status: "done",
        notes: input.notes ?? null,
      })
      .select("id")
      .single();

    if (analysisError || !analysis) return null;

    const { error: dishesError } = await supabase.from("dishes").insert(
      input.dishes.map((d, i) => ({
        analysis_id: analysis.id,
        name: d.name,
        reason: d.reason,
        nutrition_query: d.nutritionQuery,
        assumptions: d.assumptions,
        conflicts: d.conflicts,
        approx_macros: d.approxMacros,
        grounded_macros: d.groundedMacros,
        llm_draft_verdict: d.llmDraftVerdict,
        final_verdict: d.verdict,
        fit_score: d.fitScore,
        rank: i,
      }))
    );

    if (dishesError) return null;

    return analysis.id as string;
  } catch {
    // Fallo de persistencia no debe tirar el resultado ya calculado del pipeline.
    return null;
  }
}
