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

  return (
    <div className="space-y-3">
      {dishes.map((dish) => (
        <DishResultCard
          key={`${dish.name}-${dish.nutritionQuery}`}
          dish={dish}
          onToggleEaten={dish.eatenAt ? handleToggleEaten : undefined}
          disabled={pendingDishId !== null}
        />
      ))}
    </div>
  );
}
