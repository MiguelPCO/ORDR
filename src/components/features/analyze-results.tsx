"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { DishResultCard } from "@/components/features/dish-result-card";
import type { AnalyzeResponse } from "@/schemas";

export function AnalyzeResults({
  result,
  onReset,
}: {
  result: AnalyzeResponse;
  onReset: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Transición de veredicto (SPRINTS Sprint 4): revelado escalonado de las tarjetas al llegar el resultado.
  useGSAP(
    () => {
      gsap.from(".dish-card", {
        opacity: 0,
        y: 16,
        duration: 0.4,
        stagger: 0.06,
        ease: "power2.out",
      });
    },
    { scope: containerRef, dependencies: [result] }
  );

  return (
    <main ref={containerRef} className="mx-auto w-full max-w-2xl space-y-4 px-4 py-10">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {result.dishes.length} plato{result.dishes.length === 1 ? "" : "s"} analizados
        </h2>
        <button
          type="button"
          onClick={onReset}
          className="text-sm text-foreground/60 underline underline-offset-2"
        >
          Analizar otra carta
        </button>
      </div>

      {!result.menuReadOk && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          No se pudo leer la carta. {result.notes}
        </p>
      )}
      {result.menuReadOk && result.notes && (
        <p className="text-sm text-foreground/60">{result.notes}</p>
      )}

      <div className="space-y-3">
        {result.dishes.map((dish) => (
          <DishResultCard key={`${dish.name}-${dish.nutritionQuery}`} dish={dish} />
        ))}
      </div>
    </main>
  );
}
