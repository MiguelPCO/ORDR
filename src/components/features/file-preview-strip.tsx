"use client";

import { useEffect, useMemo, useState } from "react";
import { rotateImageFile } from "@/lib/image/rotate-image-file";

export function FilePreviewStrip({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const [rotateError, setRotateError] = useState<string | null>(null);

  // useMemo (no useEffect+state) para que urls[i] siempre corresponda a files[i] en el mismo
  // render — con state async había un render donde files ya cambió de orden/longitud pero
  // urls seguía siendo el del render anterior, colando un <img src=""> pasajero.
  const urls = useMemo(
    () => files.map((f) => (f.type === "application/pdf" ? null : URL.createObjectURL(f))),
    [files]
  );

  useEffect(() => {
    return () => {
      urls.forEach((u) => u && URL.revokeObjectURL(u));
    };
  }, [urls]);

  async function handleRotate(index: number) {
    try {
      const rotated = await rotateImageFile(files[index], 90);
      const next = files.slice();
      next[index] = rotated;
      setRotateError(null);
      onChange(next);
    } catch {
      setRotateError("No se pudo rotar esta imagen.");
    }
  }

  function handleRemove(index: number) {
    onChange(files.filter((_, i) => i !== index));
  }

  if (files.length === 0) return null;

  return (
    <div className="space-y-1">
      {rotateError && <p className="text-xs text-red-700 dark:text-red-400">{rotateError}</p>}
      <div className="flex gap-2 overflow-x-auto py-2">
      {files.map((file, i) => (
        <div key={`${file.name}-${file.size}-${file.lastModified}`} className="shrink-0 text-center">
          {file.type === "application/pdf" ? (
            <div className="flex h-20 w-20 items-center justify-center rounded-md border border-foreground/20 text-xs font-medium text-foreground/60">
              PDF
            </div>
          ) : (
            urls[i] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={urls[i]}
                alt=""
                className="h-20 w-20 rounded-md border border-foreground/20 object-cover"
              />
            )
          )}
          <div className="mt-1 flex justify-center gap-1">
            {file.type !== "application/pdf" && (
              <button
                type="button"
                onClick={() => handleRotate(i)}
                aria-label={`Rotar imagen ${i + 1}`}
                className="rounded bg-foreground/10 px-1.5 py-0.5 text-xs"
              >
                ↻
              </button>
            )}
            <button
              type="button"
              onClick={() => handleRemove(i)}
              aria-label={`Quitar archivo ${i + 1}`}
              className="rounded bg-foreground/10 px-1.5 py-0.5 text-xs"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}
