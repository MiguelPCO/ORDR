// Sprint 2 — prueba lib/llm/read-menu.ts contra fotos/PDF reales de carta.
// Uso: npx tsx scripts/validate-read-menu.ts ruta/foto1.jpg [ruta/foto2.jpg ...]
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { readMenu, type MenuImageInput } from "../src/lib/llm/read-menu";

const MIME: Record<string, MenuImageInput["mediaType"]> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

const paths = process.argv.slice(2);
if (paths.length < 1 || paths.length > 4) {
  console.error("Uso: npx tsx scripts/validate-read-menu.ts foto1.jpg [foto2.jpg ...] (1-4 archivos)");
  process.exit(1);
}

const images: MenuImageInput[] = paths.map((p) => {
  const ext = extname(p).toLowerCase();
  const mediaType = MIME[ext];
  if (!mediaType) throw new Error(`Extensión no soportada: ${ext}`);
  return { base64: readFileSync(p).toString("base64"), mediaType };
});

const profile = { diet: "none" as const, allergies: [] as string[], dislikes: [] as string[] };

async function main() {
  const result = await readMenu(images, profile);

  console.log(JSON.stringify(result, null, 2));
  console.log(`\nmenu_read_ok: ${result.menu_read_ok}`);
  console.log(`platos leídos: ${result.dishes.length}`);
  for (const d of result.dishes) {
    console.log(`  - ${d.name}: nutrition_query="${d.nutrition_query}"`);
  }
}

main();
