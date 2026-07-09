// FITTAYI weekly plan generation — Edge Function
// Not in the PRD's file list, but required to make "weekly plan generation"
// (PRD 9) actually work: generating each day/slot with a separate
// dish-selection call would let day 2 repeat day 1's picks, since the 3-day
// exclusion only sees user_dish_history rows written BEFORE this batch
// started. This loops server-side, tracking in-batch picks alongside
// persisted history, and writes both user_plans and user_dish_history as it
// goes. Requires a signed-in user (reads their user_profiles row).
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  distributeMeals,
  generateCalorieAndMacroTargets,
  type Goal,
  type MealSlot,
  type Sex,
  type ActivityLevel,
} from "../_shared/calorieEngine.ts";
import {
  type CandidateDish,
  type DietType,
  dietCompatibleTypes,
  hasExcludedAllergen,
  rankByProteinCloseness,
  withinCalorieTolerance,
} from "../_shared/dishSelection.ts";
import { getMealSplit } from "../_shared/mealSplit.ts";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
const DAYS_IN_WEEK = 7;
const HISTORY_WINDOW_DAYS = 3;

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonResponse({ error: "Invalid or expired session" }, 401);
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return jsonResponse({ error: "No profile found for this user. Complete the quiz first." }, 400);
  }

  const calorieResult = generateCalorieAndMacroTargets({
    sex: profile.sex as Sex,
    age: profile.age as number,
    heightCm: profile.height_cm as number,
    weightKg: profile.weight_kg as number,
    activityLevel: profile.activity_level as ActivityLevel,
    goal: profile.goal as Goal,
  });
  const mealSplit = await getMealSplit();
  const mealPlanTargets = distributeMeals(calorieResult, mealSplit);

  const dietType = profile.diet_type as DietType;
  const allergens = (profile.allergens as string[] | null) ?? [];
  const compatibleTypes = dietCompatibleTypes(dietType);

  // Load persisted history from before today, back HISTORY_WINDOW_DAYS days,
  // so day 1 of the new week still respects what was served just before it.
  const historyStart = new Date();
  historyStart.setDate(historyStart.getDate() - HISTORY_WINDOW_DAYS);
  const { data: priorHistory } = await supabase
    .from("user_dish_history")
    .select("dish_id, served_on")
    .gte("served_on", toDateString(historyStart));

  // Rolling window of {dateString -> Set<dishId>} covering persisted history
  // plus every pick made so far in this batch.
  const servedByDate = new Map<string, Set<string>>();
  for (const row of (priorHistory ?? []) as { dish_id: string; served_on: string }[]) {
    if (!servedByDate.has(row.served_on)) servedByDate.set(row.served_on, new Set());
    servedByDate.get(row.served_on)!.add(row.dish_id);
  }

  function excludedIdsFor(planDate: Date): string[] {
    const excluded = new Set<string>();
    for (let i = 1; i <= HISTORY_WINDOW_DAYS; i++) {
      const d = new Date(planDate);
      d.setDate(d.getDate() - i);
      const set = servedByDate.get(toDateString(d));
      if (set) for (const id of set) excluded.add(id);
    }
    return [...excluded];
  }

  const planRows: {
    user_id: string;
    plan_date: string;
    meal_slot: MealSlot;
    dish_id: string | null;
    target_calories: number;
    actual_calories: number | null;
  }[] = [];
  const historyRows: { user_id: string; dish_id: string; served_on: string }[] = [];

  for (let dayOffset = 0; dayOffset < DAYS_IN_WEEK; dayOffset++) {
    const planDate = new Date();
    planDate.setDate(planDate.getDate() + dayOffset);
    const planDateStr = toDateString(planDate);

    for (const target of mealPlanTargets) {
      const excludedIds = excludedIdsFor(planDate);
      const lowerBound = target.targetCalories * 0.9;
      const upperBound = target.targetCalories * 1.1;

      let query = supabase
        .from("dishes")
        .select("id, name, diet_type, calories, protein_g, carbs_g, fat_g, allergens")
        .contains("meal_type", [target.meal])
        .in("diet_type", compatibleTypes)
        .gte("calories", lowerBound)
        .lte("calories", upperBound)
        .eq("is_active", true);

      if (excludedIds.length > 0) {
        query = query.not("id", "in", `(${excludedIds.join(",")})`);
      }

      const { data: candidates } = await query;
      const filtered = ((candidates ?? []) as CandidateDish[]).filter(
        (dish) =>
          withinCalorieTolerance(dish.calories, target.targetCalories) &&
          !hasExcludedAllergen(dish.allergens, allergens)
      );
      const ranked = rankByProteinCloseness(filtered, target.targetProteinG, target.targetCalories);
      const chosen = ranked[0] ?? null;

      planRows.push({
        user_id: user.id,
        plan_date: planDateStr,
        meal_slot: target.meal,
        dish_id: chosen?.id ?? null,
        target_calories: target.targetCalories,
        actual_calories: chosen?.calories ?? null,
      });

      if (chosen) {
        historyRows.push({ user_id: user.id, dish_id: chosen.id, served_on: planDateStr });
        if (!servedByDate.has(planDateStr)) servedByDate.set(planDateStr, new Set());
        servedByDate.get(planDateStr)!.add(chosen.id);
      }
    }
  }

  const { error: insertPlansError } = await supabase.from("user_plans").insert(planRows);
  if (insertPlansError) {
    return jsonResponse({ error: "Failed to save weekly plan" }, 500);
  }

  if (historyRows.length > 0) {
    await supabase
      .from("user_dish_history")
      .upsert(historyRows, { onConflict: "user_id,dish_id,served_on", ignoreDuplicates: true });
  }

  return jsonResponse(
    {
      calorieResult,
      mealPlanTargets,
      plan: planRows,
    },
    200
  );
});
