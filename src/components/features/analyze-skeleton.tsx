"use client";

import { useEffect, useRef, useState } from "react";

const STEPS = ["Leyendo carta", "Calculando macros", "Rankeando"] as const;
// Avance simulado por tiempo: el análisis real es una sola llamada, sin progreso por
// etapas del backend. Paso 0 activo 0-2s, paso 1 activo 2-4s, paso 2 se queda activo
// hasta que la respuesta real reemplace este componente.
const STEP_ADVANCE_AT_MS = [2000, 4000];

export function AnalyzeSkeleton() {
  const ref = useRef<HTMLElement>(null);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  useEffect(() => {
    const timers = STEP_ADVANCE_AT_MS.map((ms, i) => setTimeout(() => setActiveStep(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <main
      ref={ref}
      tabIndex={-1}
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="mx-auto w-full max-w-2xl space-y-4 px-4 py-10 outline-none"
    >
      <ol className="space-y-3">
        {STEPS.map((label, i) => {
          const done = i < activeStep;
          const active = i === activeStep;
          return (
            <li
              key={label}
              className={`flex items-center gap-3 rounded-lg border border-line px-4 py-3 text-body-sm transition-colors ${
                active ? "bg-surface-tint text-ink" : "text-ink-soft"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-caption font-semibold ${
                  done ? "bg-primary text-white" : active ? "animate-pulse bg-primary/20 text-primary-deep" : "bg-line text-ink-soft"
                }`}
                aria-hidden
              >
                {done ? "✓" : i + 1}
              </span>
              {label}
            </li>
          );
        })}
      </ol>
    </main>
  );
}
