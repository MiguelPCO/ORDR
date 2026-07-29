export type RotationDegrees = 90 | 180 | 270;

export function rotatedDimensions(
  width: number,
  height: number,
  degrees: RotationDegrees
): { width: number; height: number } {
  return degrees === 180 ? { width, height } : { width: height, height: width };
}

/** Rota un File de imagen client-side vía Canvas. No soporta PDF (llamar solo con image/*). */
export async function rotateImageFile(file: File, degrees: RotationDegrees): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = rotatedDimensions(bitmap.width, bitmap.height, degrees);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas no soportado en este navegador.");
  }

  ctx.translate(width / 2, height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("No se pudo generar la imagen rotada."))),
      file.type
    );
  });

  return new File([blob], file.name, { type: file.type });
}
