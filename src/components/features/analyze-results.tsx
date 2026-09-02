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
  isAuthenticated,
}: {
  result: AnalyzeResponse;
  onReset: () => void;
  isAuthenticated: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<VerdictFilter>("all");
  const [dishes, setDishes] = useState(result.dishes);
  const [pendingDishId, setPendingDishId] = useState<string | null>(null);
  const filteredDishes = filter === "all" ? dishes : dishes.filter((d) => d.verdict === filter);

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

  async function handleToggleEaten(dishId: string) {
    if (pendingDishId) return;
    setPendingDishId(dishId);
    const previous = dishes;
    // Optimista: si ya había OTRO plato marcado en este análisis, lo desmarca en el
    // estado local también (el índice único parcial en DB solo permite uno).
    setDishes((prev) =>
      prev.map((d) => {
        if (d.id === dishId) return { ...d, eatenAt: d.eatenAt ? null : new Date().toISOString() };
        return d.eatenAt && d.id !== dishId ? { ...d, eatenAt: null } : d;
      })
    );
    try {
      const res = await fetch(`/api/dishes/${dishId}`, { method: "PATCH" });
      if (!res.ok) throw new Error("No se pudo actualizar.");
      const body = await res.json();
      setDishes((prev) => prev.map((d) => (d.id === dishId ? { ...d, eatenAt: body.eatenAt } : d)));
    } catch {
      setDishes(previous);
    } finally {
      setPendingDishId(null);
    }
  }

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

      {result.menuReadOk && (
        <p className="text-body-sm text-ink-soft">Estimado por porción estándar.</p>
      )}

      {!result.menuReadOk && (
        <p className="rounded-md bg-sem-red-bg px-3 py-2 text-body-sm text-sem-red">
          No se pudo leer la carta. {result.notes}
        </p>
      )}

      <AnalyzeHeroCard dishes={dishes} />
      <VerdictFilterChips dishes={dishes} value={filter} onChange={setFilter} />

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
            <DishResultCard
              key={`${dish.name}-${dish.nutritionQuery}`}
              dish={dish}
              onToggleEaten={isAuthenticated ? handleToggleEaten : undefined}
              disabled={pendingDishId !== null}
            />
          ))}
        </div>
      )}
    </main>
  );
}
