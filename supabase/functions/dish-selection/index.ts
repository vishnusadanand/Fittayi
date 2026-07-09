// FITTAYI dish selection — Edge Function
// Requires the caller's own JWT (forwarded to Supabase) so user_dish_history
// RLS scopes the 3-day exclusion to the calling user only, per PRD 6.3.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  type CandidateDish,
  type DietType,
  dietCompatibleTypes,
  hasExcludedAllergen,
  rankByProteinCloseness,
  withinCalorieTolerance,
} from "../_shared/dishSelection.ts";
import type { MealSlot } from "../_shared/calorieEngine.ts";

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

interface RequestBody {
  mealSlot: MealSlot;
  targetCalories: number;
  targetProteinG: number;
  dietType: DietType;
  allergens?: string[];
}

const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
const DIET_TYPES: DietType[] = ["veg", "vegan", "egg", "non_veg"];

function validateBody(body: unknown): { ok: true; value: RequestBody } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;

  if (!MEAL_SLOTS.includes(b.mealSlot as MealSlot)) {
    return { ok: false, error: `mealSlot must be one of: ${MEAL_SLOTS.join(", ")}` };
  }
  if (typeof b.targetCalories !== "number" || b.targetCalories <= 0) {
    return { ok: false, error: "targetCalories must be a positive number." };
  }
  if (typeof b.targetProteinG !== "number" || b.targetProteinG < 0) {
    return { ok: false, error: "targetProteinG must be a non-negative number." };
  }
  if (!DIET_TYPES.includes(b.dietType as DietType)) {
    return { ok: false, error: `dietType must be one of: ${DIET_TYPES.join(", ")}` };
  }
  const allergens = Array.isArray(b.allergens) ? (b.allergens as string[]) : [];

  return {
    ok: true,
    value: {
      mealSlot: b.mealSlot as MealSlot,
      targetCalories: b.targetCalories as number,
      targetProteinG: b.targetProteinG as number,
      dietType: b.dietType as DietType,
      allergens,
    },
  };
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const validation = validateBody(body);
  if (!validation.ok) {
    return jsonResponse({ error: validation.error }, 400);
  }
  const { mealSlot, targetCalories, targetProteinG, dietType, allergens } = validation.value;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return jsonResponse({ error: "Invalid or expired session" }, 401);
  }

  // Exclude dishes served to this user in the last 3 days (RLS-scoped to auth.uid()).
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const { data: history, error: historyError } = await supabase
    .from("user_dish_history")
    .select("dish_id")
    .gte("served_on", threeDaysAgo.toISOString().slice(0, 10));

  if (historyError) {
    return jsonResponse({ error: "Failed to read dish history" }, 500);
  }
  const excludedIds = (history ?? []).map((row: { dish_id: string }) => row.dish_id);

  const compatibleTypes = dietCompatibleTypes(dietType);
  const lowerBound = targetCalories * 0.9;
  const upperBound = targetCalories * 1.1;

  let query = supabase
    .from("dishes")
    .select("id, name, diet_type, calories, protein_g, carbs_g, fat_g, allergens")
    .contains("meal_type", [mealSlot])
    .in("diet_type", compatibleTypes)
    .gte("calories", lowerBound)
    .lte("calories", upperBound)
    .eq("is_active", true);

  if (excludedIds.length > 0) {
    query = query.not("id", "in", `(${excludedIds.join(",")})`);
  }

  const { data: candidates, error: dishesError } = await query;
  if (dishesError) {
    return jsonResponse({ error: "Failed to query dishes" }, 500);
  }

  const filtered = ((candidates ?? []) as CandidateDish[]).filter(
    (dish) =>
      withinCalorieTolerance(dish.calories, targetCalories) &&
      !hasExcludedAllergen(dish.allergens, allergens ?? [])
  );

  const ranked = rankByProteinCloseness(filtered, targetProteinG, targetCalories);

  return jsonResponse(
    {
      pick: ranked[0] ?? null,
      alternates: ranked.slice(1, 5),
    },
    200
  );
});
