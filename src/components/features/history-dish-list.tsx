"use client";

import { useState } from "react";
import { DishResultCard } from "@/components/features/dish-result-card";
import type { AnalyzedDish } from "@/schemas";

export function HistoryDishList({ initialDishes }: { initialDishes: AnalyzedDish[] }) {
  const [dishes, setDishes] = useState(initialDishes);
  const [pendingDishId, setPendingDishId] = useState<string | null>(null);

  async function handleToggleEaten(dishId: string) {
    if (pendingDishId) return;
    setPendingDishId(dishId);
    const previous = dishes;
    setDishes((prev) => prev.map((d) => (d.id === dishId ? { ...d, eatenAt: null } : d)));
    try {
      const res = await fetch(`/api/dishes/${dishId}`, { method: "PATCH" });
      if (!res.ok) throw new Error("No se pudo actualizar.");
    } catch {
      setDishes(previous);
    } finally {
      setPendingDishId(null);
    }
  }

  async function handleFeedback(dishId: string, agree: boolean) {
    const previous = dishes;
    setDishes((prev) => prev.map((d) => (d.id === dishId ? { ...d, verdictFeedback: agree } : d)));
    try {
      const res = await fetch(`/api/dishes/${dishId}/feedback`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agree }),
      });
      if (!res.ok) throw new Error("No se pudo guardar el feedback.");
    } catch {
      setDishes(previous);
    }
  }

  return (
    <div className="space-y-3">
      {dishes.map((dish) => (
        <DishResultCard
          key={dish.id ?? `${dish.name}-${dish.nutritionQuery}`}
          dish={dish}
          onToggleEaten={dish.eatenAt ? handleToggleEaten : undefined}
          onFeedback={handleFeedback}
          disabled={pendingDishId !== null}
        />
      ))}
    </div>
  );
}
