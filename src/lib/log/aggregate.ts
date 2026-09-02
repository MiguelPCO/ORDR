export type LoggedDish = {
  eatenAt: string;
  macros: { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
};

export type DayTotals = {
  date: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export function aggregateByDay(dishes: LoggedDish[]): DayTotals[] {
  const byDate = new Map<string, DayTotals>();

  for (const dish of dishes) {
    const date = dish.eatenAt.slice(0, 10); // YYYY-MM-DD, ISO ya viene en UTC
    const existing = byDate.get(date) ?? { date, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
    byDate.set(date, {
      date,
      kcal: existing.kcal + dish.macros.kcal,
      protein_g: existing.protein_g + dish.macros.protein_g,
      carbs_g: existing.carbs_g + dish.macros.carbs_g,
      fat_g: existing.fat_g + dish.macros.fat_g,
    });
  }

  return Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
}
