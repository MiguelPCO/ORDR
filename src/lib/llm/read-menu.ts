import Anthropic from "@anthropic-ai/sdk";
import { LlmResponseSchema, type Diet } from "@/schemas";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

export type MenuImageInput = {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
};

export type ReadMenuProfile = {
  diet: Diet;
  allergies: string[];
  dislikes: string[];
};

const SYSTEM_PROMPT = `Eres el módulo de lectura de cartas de restaurante de ORDR. Recibes 1-4 fotos y/o un PDF de una carta, en cualquier idioma, y el perfil dietético del usuario.

Para cada plato de la carta, produce:
1. "name": nombre del plato tal como aparece (traducido al español si conviene para claridad).
2. "verdict": tu borrador de veredicto ("green"/"amber"/"red") — SOLO se usa como fallback si el fundamentado de macros falla; el veredicto real lo calcula otro sistema.
3. "reason": por qué, en una frase.
4. "nutrition_query": la lista de ingredientes CON cantidad estimada, en inglés, para pasar a una API de nutrición (ej. "150g grilled chicken breast, 100g white rice, 1 tbsp olive oil").
   REGLA CRÍTICA: nunca mezcles el nombre genérico del plato con sus ingredientes en la misma query (ej. NO "paella with chicken, shrimp, and rice" — eso causa doble conteo de macros porque la API reconoce el plato Y los ingredientes por separado). Descompón SIEMPRE en ingredientes puros con cantidad, nunca el nombre del plato.
5. "approx": tu propia estimación aproximada de macros {kcal, protein_g, carbs_g, fat_g} para ese plato completo (fallback si la API de nutrición falla).
6. "assumptions": qué asumiste sobre la porción o preparación (ej. "asume ración media de 350g, no incluye pan de acompañamiento").
7. "conflicts": array de strings — cualquier conflicto con la dieta, las alergias, y los ingredientes que el usuario dice que no le gustan (te las paso en el siguiente mensaje). Si hay un alérgeno presente O un ingrediente de la lista "no me gusta", decláralo explícitamente aquí — mismo trato para ambos casos.

Responde ÚNICAMENTE con un objeto JSON con esta forma (sin markdown, sin texto antes o después):
{
  "menu_read_ok": boolean,
  "dishes": [ { "name": ..., "verdict": ..., "reason": ..., "nutrition_query": ..., "approx": {...}, "assumptions": ..., "conflicts": [...] } ],
  "notes": "cualquier advertencia global (ej. carta borrosa, sección no legible)"
}

Si no puedes leer la carta en absoluto, devuelve "menu_read_ok": false, "dishes": [], y explica por qué en "notes".`;

function buildUserText(profile: ReadMenuProfile): string {
  return `Perfil del usuario — dieta: "${profile.diet}", alergias: [${profile.allergies
    .map((a) => `"${a}"`)
    .join(", ")}], no le gusta: [${profile.dislikes
    .map((d) => `"${d}"`)
    .join(", ")}]. Lee la carta adjunta y descompón cada plato según las instrucciones.`;
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Respuesta del LLM no contiene un objeto JSON.");
  }
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch (e) {
    const tail = slice.slice(-300);
    throw new Error(
      `JSON.parse falló (${(e as Error).message}). Longitud=${slice.length}. Últimos 300 chars: ${tail}`
    );
  }
}

export async function readMenu(images: MenuImageInput[], profile: ReadMenuProfile) {
  if (images.length < 1 || images.length > 4) {
    throw new Error("readMenu acepta entre 1 y 4 imágenes/PDF.");
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const content: Anthropic.Messages.ContentBlockParam[] = images.map((img) =>
    img.mediaType === "application/pdf"
      ? {
          type: "document",
          source: { type: "base64", media_type: img.mediaType, data: img.base64 },
        }
      : {
          type: "image",
          source: { type: "base64", media_type: img.mediaType, data: img.base64 },
        }
  );
  content.push({ type: "text", text: buildUserText(profile) });

  // Non-streaming create() aplica un timeout heurístico para respuestas largas
  // (menús con muchos platos); streaming lo evita.
  const response = await anthropic.messages
    .stream({
      model: MODEL,
      max_tokens: 32000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    })
    .finalMessage();

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("El LLM no devolvió texto.");
  }

  if (response.stop_reason === "max_tokens") {
    throw new Error(
      "Respuesta truncada por max_tokens — la carta tiene más platos de los que caben en el límite actual."
    );
  }

  const json = extractJson(textBlock.text);
  const parsed = LlmResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new Error(`Respuesta del LLM no cumple LlmResponseSchema: ${parsed.error.message}`);
  }

  return parsed.data;
}
