"use client";

import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { DishResultCard } from "@/components/features/dish-result-card";
import { AnalyzeHeroCard } from "@/components/features/analyze-hero-card";
import { VerdictFilterChips, type VerdictFilter } from "@/components/features/verdict-filter-chips";
import type { AnalyzeResponse } from "@/schemas";

export function AnalyzeResults({
  result,
  onReset,
}: {
  result: AnalyzeResponse;
  onReset: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<VerdictFilter>("all");
  const filteredDishes =
    filter === "all" ? result.dishes : result.dishes.filter((d) => d.verdict === filter);

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
    { scope: containerRef, dependencies: [result, filter] }
  );

  return (
    <main ref={containerRef} className="mx-auto w-full max-w-2xl space-y-4 px-4 py-10">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Resultado</h2>
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

      <AnalyzeHeroCard dishes={result.dishes} />
      <VerdictFilterChips dishes={result.dishes} value={filter} onChange={setFilter} />

      {filteredDishes.length === 0 ? (
        <p className="rounded-md border border-foreground/10 px-4 py-6 text-center text-sm text-foreground/60">
          Ningún plato en esta categoría.
        </p>
      ) : (
        <div className="space-y-3">
          {filteredDishes.map((dish) => (
            <DishResultCard key={`${dish.name}-${dish.nutritionQuery}`} dish={dish} />
          ))}
        </div>
      )}
    </main>
  );
}
