"use client";

import { useRef } from "react";
import { FilePreviewStrip } from "@/components/features/file-preview-strip";

export function AnalyzeFileUpload({
  files,
  onFilesChange,
  onAddFiles,
  isPreparingFiles,
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
  onAddFiles: (files: File[]) => void;
  isPreparingFiles: boolean;
}) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  function handleCameraCapture(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    onAddFiles(Array.from(fileList));
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  function handleGallerySelect(fileList: FileList | null) {
    if (!fileList) return;
    onAddFiles(Array.from(fileList));
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Foto(s) o PDF de la carta (1-4)</p>
      <p className="text-xs text-foreground/60">Captura la carta completa, no solo lo visible en pantalla.</p>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleCameraCapture(e.target.files)}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={(e) => handleGallerySelect(e.target.files)}
        className="hidden"
      />

      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPreparingFiles}
          onClick={() => cameraInputRef.current?.click()}
          className="flex-1 rounded-md border border-brand-dark/50 px-3 py-2 text-sm font-medium text-brand-dark transition-colors hover:bg-brand-soft disabled:opacity-50"
        >
          Hacer foto
        </button>
        <button
          type="button"
          disabled={isPreparingFiles}
          onClick={() => galleryInputRef.current?.click()}
          className="flex-1 rounded-md border border-foreground/20 px-3 py-2 text-sm font-medium transition-colors hover:bg-foreground/5 disabled:opacity-50"
        >
          Elegir archivos
        </button>
      </div>

      {isPreparingFiles && <p className="text-xs text-foreground/60">Preparando imagen(es)…</p>}

      <FilePreviewStrip files={files} onChange={onFilesChange} />
    </div>
  );
}
