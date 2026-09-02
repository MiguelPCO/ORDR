// R6 (PRD.md) — Claude Vision rechaza payloads base64 >10MB. El límite es sobre el
// tamaño CODIFICADO (base64 infla ~33%), no sobre el tamaño del archivo original —
// un archivo de 8.4MB ya supera el cap tras codificar. Recomprime client-side antes
// de subir en vez de solo validar, para no bloquear al usuario con fotos de móvil normales.
const CLAUDE_MAX_ENCODED_BYTES = 10_485_760;
const RAW_BUDGET_BYTES = Math.floor((CLAUDE_MAX_ENCODED_BYTES * 3) / 4) - 200_000;
const MAX_ATTEMPTS = 6;

export async function compressImageIfNeeded(file: File): Promise<File> {
  if (file.size <= RAW_BUDGET_BYTES) return file;

  const bitmap = await createImageBitmap(file);
  let width = bitmap.width;
  let height = bitmap.height;
  let quality = 0.9;

  try {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D no disponible en este navegador.");
      ctx.drawImage(bitmap, 0, 0, width, height);

      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("No se pudo codificar la imagen comprimida."))),
          "image/jpeg",
          quality
        )
      );

      if (blob.size <= RAW_BUDGET_BYTES) {
        return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
      }

      if (quality > 0.5) {
        quality -= 0.15;
      } else {
        width = Math.round(width * 0.8);
        height = Math.round(height * 0.8);
      }
    }
  } finally {
    bitmap.close();
  }

  throw new Error(`No se pudo comprimir "${file.name}" bajo el límite de Claude Vision (10MB).`);
}
