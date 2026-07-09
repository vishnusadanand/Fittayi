import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { computeCalorieTargets } from "../lib/api";
import { buildDemoWeek, type DemoDay } from "../lib/demoWeek";
import type { Dish, MealSlot } from "../types/fittayi";

const PLANS = [
  {
    name: "Cut",
    goal: "cut",
    description: "A structured 20% deficit that keeps protein high, so you lose fat without losing the muscle you've built.",
  },
  {
    name: "Build",
    goal: "build",
    description: "A 10% surplus sized to add muscle without the excess fat gain that comes from eating without a plan.",
  },
  {
    name: "Recomp",
    goal: "recomp",
    description: "A modest 5% deficit paired with high protein, built for people trying to lose fat and gain strength at the same time.",
  },
  {
    name: "Maintain",
    goal: "maintain",
    description: "Calories set at your true maintenance, for holding steady while you focus on training or a life event.",
  },
];

const METHOD_STEPS = [
  {
    title: "Diagnose",
    description: "Ten focused questions map your stats, goal, kitchen, and dietary restrictions.",
  },
  {
    title: "Calculate",
    description: "A deterministic engine computes your BMR, TDEE, macro split, and per-meal targets — with hard safety floors it will never cross.",
  },
  {
    title: "Eat",
    description: "Real Kerala and South Indian dishes matched to your targets, not generic templates.",
  },
];

const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export function LandingPage() {
  const [allDishes, setAllDishes] = useState<Dish[]>([]);
  const [demoWeek, setDemoWeek] = useState<DemoDay[]>([]);
  const [dailyCalories, setDailyCalories] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("dishes")
        .select("id, name, diet_type, calories, protein_g, carbs_g, fat_g, allergens, meal_type")
        .eq("is_active", true);

      const dishes = (data ?? []) as (Dish & { meal_type: MealSlot[] })[];
      setAllDishes(dishes);

      try {
        const result = await computeCalorieTargets({
          sex: "male",
          age: 30,
          heightCm: 175,
          weightKg: 75,
          activityLevel: "moderate",
          goal: "cut",
        });
        setDailyCalories(result.calories);
        setDemoWeek(buildDemoWeek(dishes, result.mealPlan));
      } catch {
        // Landing page should still render without the live demo week if the
        // engine call fails (e.g. offline) -- it's illustrative, not required.
      }
    }
    load();
  }, []);

  const countsBySlot: Record<MealSlot, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
  for (const dish of allDishes as (Dish & { meal_type?: MealSlot[] })[]) {
    for (const slot of dish.meal_type ?? []) {
      countsBySlot[slot] = (countsBySlot[slot] ?? 0) + 1;
    }
  }

  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Eat Like You Mean It.</h1>
        <p className="mt-4 text-lg text-ink-muted">
          Ten questions. One sharp daily meal plan — calories, macros, real dishes — built around
          your body, your goal, and a Kerala-first kitchen.
        </p>
        <div className="mt-8 flex flex-col items-center gap-2">
          <Link
            to="/quiz"
            className="rounded-full bg-gold px-8 py-3 text-base font-semibold text-backwater hover:brightness-90"
          >
            Build My Meal Plan
          </Link>
          <span className="text-xs text-ink-muted">90 seconds &middot; No signup required</span>
        </div>
      </section>

      {/* Plans */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold">One Plan. Your Goal.</h2>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <div
              key={plan.goal}
              className="rounded-xl border border-line bg-surface p-5"
            >
              <h3 className="font-display font-semibold">{plan.name}</h3>
              <p className="mt-2 text-sm text-ink-muted">{plan.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Method */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold">Inputs In. Plate Out.</h2>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {METHOD_STEPS.map((step, i) => (
            <div key={step.title}>
              <span className="font-mono text-sm font-semibold text-gold">{`0${i + 1}`}</span>
              <h3 className="mt-1 font-display font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-ink-muted">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Sample Week */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold">7 Days. Real Plates.</h2>
        <p className="mt-2 text-center text-sm text-ink-muted">
          {dailyCalories
            ? <>Illustrative example at ~<span className="font-mono tabular-nums">{dailyCalories}</span> kcal/day (moderate activity, cut goal) — real dishes from our catalog, not a personalized plan.</>
            : "Loading a live example from our dish catalog..."}
        </p>
        <div className="mt-8 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-left">
                <th className="py-2 pr-4 pl-4 font-display">Day</th>
                <th className="py-2 pr-4 font-display">Breakfast</th>
                <th className="py-2 pr-4 font-display">Lunch</th>
                <th className="py-2 pr-4 font-display">Dinner</th>
                <th className="py-2 pr-4 font-display">Snack</th>
              </tr>
            </thead>
            <tbody>
              {demoWeek.map((day) => (
                <tr key={day.day} className="border-b border-line last:border-b-0">
                  <td className="py-2 pr-4 pl-4 font-medium">{day.day}</td>
                  {day.meals.map((m) => (
                    <td key={m.slot} className="py-2 pr-4 text-ink-muted">
                      {m.dish ? (
                        <>
                          {m.dish.name} (
                          <span className="font-mono tabular-nums">{m.dish.calories}</span> kcal)
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Dishes / Menu */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold">The Menu.</h2>
        <p className="mt-2 text-center text-sm text-ink-muted">
          {allDishes.length}+ dishes, Kerala and South Indian first, across every diet type.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(Object.keys(MEAL_SLOT_LABELS) as MealSlot[]).map((slot) => (
            <div
              key={slot}
              className="rounded-xl border border-line bg-surface p-5 text-center"
            >
              <div className="font-mono text-2xl font-bold tabular-nums text-gold">{countsBySlot[slot]}</div>
              <div className="text-sm text-ink-muted">{MEAL_SLOT_LABELS[slot]}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <Link
          to="/quiz"
          className="rounded-full bg-gold px-8 py-3 text-base font-semibold text-backwater hover:brightness-90"
        >
          Start The Diagnostic
        </Link>
      </section>
    </div>
  );
}
