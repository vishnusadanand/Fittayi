import { createClient } from "npm:@supabase/supabase-js@2";
import { DEFAULT_MEAL_SPLIT, type MealSlot } from "./calorieEngine.ts";

const REQUIRED_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

// PRD 6.1: meal distribution "must be stored as a configurable table, not
// hardcoded." This reads meal_split_config (public-read per RLS) and falls
// back to the DEFAULT_MEAL_SPLIT constant only if the table is unreachable
// or misconfigured, so the Edge Function never hard-fails on a DB hiccup.
export async function getMealSplit(): Promise<Record<MealSlot, number>> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) return DEFAULT_MEAL_SPLIT;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase
      .from("meal_split_config")
      .select("meal_slot, pct")
      .eq("is_active", true);

    if (error || !data || data.length === 0) return DEFAULT_MEAL_SPLIT;

    const split = {} as Record<MealSlot, number>;
    for (const row of data as { meal_slot: MealSlot; pct: number }[]) {
      split[row.meal_slot] = Number(row.pct);
    }

    const hasAllSlots = REQUIRED_SLOTS.every((slot) => slot in split);
    return hasAllSlots ? split : DEFAULT_MEAL_SPLIT;
  } catch {
    return DEFAULT_MEAL_SPLIT;
  }
}
