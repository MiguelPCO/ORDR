"use client";

import { useRef, useState } from "react";
import { useSessionStore, readAnonymousProfile } from "@/stores/session-store";
import { ProfileForm } from "@/components/features/profile-form";
import { AnalyzeResults } from "@/components/features/analyze-results";
import { AnalyzeSkeleton } from "@/components/features/analyze-skeleton";
import { FilePreviewStrip } from "@/components/features/file-preview-strip";
import { compressImageIfNeeded } from "@/lib/image/compress-image";
import { targets } from "@/lib/nutrition/targets";
import type { Profile, Goal, AnalyzeResponse } from "@/schemas";

const MAX_FILES = 4;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_PDF_BYTES = 32 * 1024 * 1024; // R6 (PRD.md) — límite de Claude Vision para PDF, validado Sprint 2

const GOAL_LABEL: Record<Goal, string> = {
  cut: "Definición",
  bulk: "Volumen",
  maintain: "Mantenimiento",
};

export function AnalyzeClient({
  initialProfile,
  isAuthenticated,
}: {
  initialProfile: Profile | null;
  isAuthenticated: boolean;
}) {
  const anonymousDraft = useSessionStore((s) => s.anonymousProfileDraft);
  const setAnonymousProfile = useSessionStore((s) => s.setAnonymousProfile);
  const anonymousProfile = readAnonymousProfile(anonymousDraft);

  const profile = initialProfile ?? anonymousProfile;

  const [goal, setGoal] = useState<Goal | null>(null);
  const [sessionAllergiesExtra, setSessionAllergiesExtra] = useState("");
  const [sessionDislikesExtra, setSessionDislikesExtra] = useState("");
  const [sessionFatLimitG, setSessionFatLimitG] = useState<number | "">("");
  const [sessionCarbLimitG, setSessionCarbLimitG] = useState<number | "">("");
  const [files, setFiles] = useState<File[]>([]);
  const [isPreparingFiles, setIsPreparingFiles] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  if (isAuthenticated && !profile) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-foreground/70">
          Completa tu perfil antes de analizar una carta —{" "}
          <a href="/profile" className="underline">
            ir a Perfil
          </a>
          .
        </p>
      </main>
    );
  }

  if (!profile) {
    return (
      <div>
        <p className="mx-auto mt-8 max-w-lg text-center text-sm text-foreground/60">
          Modo invitado: este perfil no se guarda, solo vive en esta pestaña.
        </p>
        <ProfileForm profile={null} onSave={setAnonymousProfile} submitLabel="Continuar" />
      </div>
    );
  }

  const sessionGoal = goal ?? profile.goal;
  const effectiveFatLimitG = sessionFatLimitG === "" ? profile.fatLimitG : sessionFatLimitG;
  const effectiveCarbLimitG = sessionCarbLimitG === "" ? profile.carbLimitG : sessionCarbLimitG;

  function validateTypes(newFiles: File[]): boolean {
    const invalid = newFiles.find((f) => !ACCEPTED_TYPES.has(f.type));
    if (invalid) {
      setErrorMsg(`Tipo no soportado: ${invalid.type || invalid.name}`);
      return false;
    }
    const oversizedPdf = newFiles.find((f) => f.type === "application/pdf" && f.size > MAX_PDF_BYTES);
    if (oversizedPdf) {
      setErrorMsg(`"${oversizedPdf.name}" supera el límite de 32MB para PDF.`);
      return false;
    }
    return true;
  }

  async function addFiles(incoming: File[]) {
    if (!validateTypes(incoming)) return;
    // Descarta duplicados por identidad (mismo archivo elegido dos veces): evita
    // enviar la misma imagen dos veces al análisis y evita colisiones de key en
    // FilePreviewStrip (que usa name+size+lastModified como key estable).
    const isDuplicate = (f: File) =>
      files.some((p) => p.name === f.name && p.size === f.size && p.lastModified === f.lastModified);
    const fresh = incoming.filter((f) => !isDuplicate(f));
    const room = MAX_FILES - files.length;
    if (fresh.length > room) {
      setErrorMsg(`Máximo ${MAX_FILES} archivos — no se añadieron todos.`);
    } else if (fresh.length < incoming.length) {
      setErrorMsg("Ese archivo ya estaba añadido — no se duplicó.");
    } else {
      setErrorMsg(null);
    }
    const toAdd = fresh.slice(0, room);

    setIsPreparingFiles(true);
    try {
      // R6 — recomprime imágenes grandes client-side antes de subir (PDF no se toca, límite propio arriba).
      const prepared = await Promise.all(
        toAdd.map((f) => (f.type === "application/pdf" ? f : compressImageIfNeeded(f)))
      );
      setFiles((prev) => [...prev, ...prepared].slice(0, MAX_FILES));
    } catch (e) {
      setErrorMsg((e as Error).message);
    } finally {
      setIsPreparingFiles(false);
    }
  }

  function handleCameraCapture(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    void addFiles(Array.from(fileList));
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  function handleGallerySelect(fileList: FileList | null) {
    if (!fileList) return;
    void addFiles(Array.from(fileList));
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  }

  async function handleSubmit() {
    if (files.length < 1) {
      setErrorMsg("Sube al menos 1 imagen o PDF de la carta.");
      return;
    }
    setStatus("loading");
    setErrorMsg(null);

    const t = targets(profile!);
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    fd.set(
      "payload",
      JSON.stringify({
        goal: sessionGoal,
        profileSnapshot: {
          mealKcal: t.mealKcal,
          mealProtein: t.mealProtein,
          diet: profile!.diet,
          allergies: profile!.allergies,
          allergiesExtra: sessionAllergiesExtra
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean),
          dislikes: profile!.dislikes,
          dislikesExtra: sessionDislikesExtra
            .split(",")
            .map((d) => d.trim())
            .filter(Boolean),
          fatLimitG: effectiveFatLimitG,
          carbLimitG: effectiveCarbLimitG,
        },
      })
    );

    try {
      const res = await fetch("/api/analyze", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error ?? "Error analizando la carta.");
        setStatus("error");
        return;
      }
      setResult(json as AnalyzeResponse);
      setStatus("done");
    } catch {
      setErrorMsg("No se pudo conectar con el servidor.");
      setStatus("error");
    }
  }

  if (status === "loading") {
    return <AnalyzeSkeleton />;
  }

  if (status === "done" && result) {
    return (
      <AnalyzeResults
        result={result}
        onReset={() => {
          setResult(null);
          setFiles([]);
          setStatus("idle");
        }}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg space-y-6 px-4 py-10">
      {!isAuthenticated && (
        <div className="flex items-center justify-between rounded-full bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent-dark">
          <span>Modo invitado — este análisis no se guarda</span>
          <a href="/signup" className="underline underline-offset-2">
            Crear cuenta
          </a>
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor="goal" className="text-sm font-medium">
          Objetivo de esta sesión
        </label>
        <select
          id="goal"
          value={sessionGoal}
          onChange={(e) => setGoal(e.target.value as Goal)}
          className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
        >
          {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => (
            <option key={g} value={g}>
              {GOAL_LABEL[g]}
            </option>
          ))}
        </select>
      </div>

      <details className="rounded-md border border-foreground/20 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">Más filtros</summary>
        <div className="mt-3 space-y-3">
          <div className="space-y-1">
            <label htmlFor="sessionAllergiesExtra" className="text-sm font-medium">
              Alergias extra para esta carta
            </label>
            <input
              id="sessionAllergiesExtra"
              value={sessionAllergiesExtra}
              onChange={(e) => setSessionAllergiesExtra(e.target.value)}
              className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="sessionDislikesExtra" className="text-sm font-medium">
              No me gusta extra para esta carta
            </label>
            <input
              id="sessionDislikesExtra"
              value={sessionDislikesExtra}
              onChange={(e) => setSessionDislikesExtra(e.target.value)}
              className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="sessionFatLimitG" className="text-sm font-medium">
                Límite grasa (g)
              </label>
              <input
                id="sessionFatLimitG"
                type="number"
                placeholder={profile.fatLimitG != null ? `perfil: ${profile.fatLimitG} g` : "sin límite"}
                value={sessionFatLimitG}
                onChange={(e) =>
                  setSessionFatLimitG(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="sessionCarbLimitG" className="text-sm font-medium">
                Límite carbos (g)
              </label>
              <input
                id="sessionCarbLimitG"
                type="number"
                placeholder={profile.carbLimitG != null ? `perfil: ${profile.carbLimitG} g` : "sin límite"}
                value={sessionCarbLimitG}
                onChange={(e) =>
                  setSessionCarbLimitG(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      </details>

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

        {isPreparingFiles && (
          <p className="text-xs text-foreground/60">Preparando imagen(es)…</p>
        )}

        <FilePreviewStrip files={files} onChange={setFiles} />
      </div>

      {errorMsg && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {errorMsg}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={files.length === 0 || isPreparingFiles}
        className="w-full rounded-md bg-brand-dark px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-darker disabled:opacity-50"
      >
        Analizar carta
      </button>
    </main>
  );
}
