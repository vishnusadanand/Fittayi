import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { computeCalorieTargets, generateWeeklyPlan, selectDish } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { FloorClampBanner } from "../components/FloorClampBanner";
import { Disclaimer } from "../components/Disclaimer";
import type { ActivityLevel, DietType, Goal, MealSlot, Sex } from "../types/fittayi";

interface PlanRow {
  id: string;
  plan_date: string;
  meal_slot: MealSlot;
  dish_id: string | null;
  target_calories: number;
  actual_calories: number | null;
  eaten_at: string | null;
  dish: { id: string; name: string; calories: number; protein_g: number } | null;
}

const MEAL_SLOT_ORDER: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [clampReason, setClampReason] = useState<string | undefined>(undefined);
  const [swappingId, setSwappingId] = useState<string | null>(null);

  const loadPlan = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile) {
      const result = await computeCalorieTargets({
        sex: profile.sex as Sex,
        age: profile.age as number,
        heightCm: profile.height_cm as number,
        weightKg: profile.weight_kg as number,
        activityLevel: profile.activity_level as ActivityLevel,
        goal: profile.goal as Goal,
      });
      setClampReason(result.wasFloorClamped ? result.clampReason : undefined);
    }

    const { data } = await supabase
      .from("user_plans")
      .select("id, plan_date, meal_slot, dish_id, target_calories, actual_calories, eaten_at, dish:dishes(id, name, calories, protein_g)")
      .order("plan_date", { ascending: true });

    setRows(((data ?? []) as unknown) as PlanRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
      return;
    }
    loadPlan();
  }, [authLoading, user, navigate, loadPlan]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      await generateWeeklyPlan();
      await loadPlan();
    } finally {
      setGenerating(false);
    }
  }

  async function handleMarkEaten(row: PlanRow) {
    const eatenAt = row.eaten_at ? null : new Date().toISOString();
    await supabase.from("user_plans").update({ eaten_at: eatenAt }).eq("id", row.id);
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, eaten_at: eatenAt } : r)));
  }

  async function handleSwap(row: PlanRow) {
    if (!user) return;
    setSwappingId(row.id);
    try {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!profile) return;

      const result = await computeCalorieTargets({
        sex: profile.sex as Sex,
        age: profile.age as number,
        heightCm: profile.height_cm as number,
        weightKg: profile.weight_kg as number,
        activityLevel: profile.activity_level as ActivityLevel,
        goal: profile.goal as Goal,
      });
      const target = result.mealPlan.find((m) => m.meal === row.meal_slot);
      if (!target) return;

      const selection = await selectDish({
        mealSlot: row.meal_slot,
        targetCalories: target.targetCalories,
        targetProteinG: target.targetProteinG,
        dietType: profile.diet_type as DietType,
        allergens: (profile.allergens as string[] | null) ?? [],
      });
      if (!selection.pick) return;

      if (row.dish_id) {
        await supabase
          .from("user_dish_history")
          .delete()
          .eq("user_id", user.id)
          .eq("dish_id", row.dish_id)
          .eq("served_on", row.plan_date);
      }

      await supabase
        .from("user_plans")
        .update({ dish_id: selection.pick.id, actual_calories: selection.pick.calories })
        .eq("id", row.id);

      await supabase
        .from("user_dish_history")
        .upsert(
          { user_id: user.id, dish_id: selection.pick.id, served_on: row.plan_date },
          { onConflict: "user_id,dish_id,served_on", ignoreDuplicates: true }
        );

      await loadPlan();
    } finally {
      setSwappingId(null);
    }
  }

  if (loading) {
    return <p className="mx-auto max-w-5xl px-4 py-16 text-center text-sm text-ink-muted">Loading your plan...</p>;
  }

  const days = [...new Set(rows.map((r) => r.plan_date))].sort();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold">Your Weekly Plan</h1>
      <FloorClampBanner clampReason={clampReason} />

      {days.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="text-sm text-ink-muted">No plan yet.</p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="mt-4 rounded-full bg-gold px-6 py-2 font-medium text-backwater hover:brightness-90 disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate my weekly plan"}
          </button>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-8">
          {days.map((day) => (
            <div key={day}>
              <h2 className="mb-3 font-display font-semibold">
                {new Date(day + "T00:00:00").toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {MEAL_SLOT_ORDER.map((slot) => {
                  const row = rows.find((r) => r.plan_date === day && r.meal_slot === slot);
                  if (!row) return null;
                  return (
                    <div
                      key={slot}
                      className={`rounded-lg border p-4 ${
                        row.eaten_at ? "border-cardamom bg-cardamom/10" : "border-line bg-surface"
                      }`}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                        {MEAL_SLOT_LABELS[slot]}
                      </p>
                      <p className="mt-1 font-medium">{row.dish?.name ?? "No match"}</p>
                      {row.dish && (
                        <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-gold">
                          {row.dish.calories} kcal{" "}
                          <span className="font-body text-xs font-normal text-ink-muted">
                            &middot; {row.dish.protein_g}g protein
                          </span>
                        </p>
                      )}
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => handleMarkEaten(row)}
                          className={`rounded-full border px-3 py-1 text-xs text-ink transition-colors ${
                            row.eaten_at ? "border-cardamom" : "border-line hover:border-gold"
                          }`}
                        >
                          {row.eaten_at ? "Eaten ✓" : "Mark eaten"}
                        </button>
                        <button
                          onClick={() => handleSwap(row)}
                          disabled={swappingId === row.id}
                          className="rounded-full border border-line px-3 py-1 text-xs text-ink hover:border-gold disabled:opacity-50"
                        >
                          {swappingId === row.id ? "Swapping..." : "Swap"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Disclaimer className="mt-12" />
    </div>
  );
}
