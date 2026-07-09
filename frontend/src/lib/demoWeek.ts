import type { Dish, MealPlanTarget, MealSlot } from "../types/fittayi";

// Builds a purely illustrative 7-day table for the landing page's "Sample
// Week" section, using REAL dishes and REAL engine-computed targets (no
// fabricated numbers) -- but with simplified rotation rather than the full
// dish-selection algorithm (history exclusion, live user profile), since
// this runs pre-quiz with no user context. The actual quiz flow uses the
// real dish-selection Edge Function.
export interface DemoDay {
  day: string;
  meals: { slot: MealSlot; dish: Dish | null }[];
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function buildDemoWeek(allDishes: Dish[], targets: MealPlanTarget[]): DemoDay[] {
  const bySlot = new Map<MealSlot, Dish[]>();
  for (const target of targets) {
    const lower = target.targetCalories * 0.9;
    const upper = target.targetCalories * 1.1;
    const candidates = allDishes
      .filter((d) => d.calories >= lower && d.calories <= upper)
      .sort((a, b) => Math.abs(a.protein_g - target.targetProteinG) - Math.abs(b.protein_g - target.targetProteinG));
    bySlot.set(target.meal, candidates);
  }

  return DAY_NAMES.map((day, dayIndex) => ({
    day,
    meals: targets.map((target) => {
      const candidates = bySlot.get(target.meal) ?? [];
      if (candidates.length === 0) return { slot: target.meal, dish: null };
      const dish = candidates[dayIndex % candidates.length];
      return { slot: target.meal, dish };
    }),
  }));
}
