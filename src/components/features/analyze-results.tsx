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

  useGSAP(
    () => {
      if (filteredDishes.length > 0) {
        gsap.from(".dish-card", {
          opacity: 0,
          y: 16,
          duration: 0.4,
          stagger: 0.06,
          ease: "power2.out",
        });
      }
    },
    { scope: containerRef, dependencies: [result, filter] }
  );

  return (
    <main ref={containerRef} className="mx-auto w-full max-w-2xl space-y-4 px-4 py-10">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-h2 font-semibold text-ink">Resultado</h2>
        <button
          type="button"
          onClick={onReset}
          className="text-body-sm text-ink-soft underline underline-offset-2"
        >
          Analizar otra carta
        </button>
      </div>

      {!result.menuReadOk && (
        <p className="rounded-md bg-sem-red-bg px-3 py-2 text-body-sm text-sem-red">
          No se pudo leer la carta. {result.notes}
        </p>
      )}

      <AnalyzeHeroCard dishes={result.dishes} />
      <VerdictFilterChips dishes={result.dishes} value={filter} onChange={setFilter} />

      {result.menuReadOk && result.notes && (
        <details className="rounded-md border border-line px-3 py-2 text-body-sm">
          <summary className="cursor-pointer text-ink-soft">Sobre esta carta</summary>
          <p className="mt-2 text-ink-soft">{result.notes}</p>
        </details>
      )}

      {filteredDishes.length === 0 ? (
        <p className="rounded-md border border-line px-4 py-6 text-center text-body-sm text-ink-soft">
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
