import { assertEquals, assertMatch } from "jsr:@std/assert";
import {
  applyGoalAndFloor,
  calculateMacros,
  distributeMeals,
  generateCalorieAndMacroTargets,
} from "./calorieEngine.ts";

// Locks in the PRD's worked example (Section 8.2): 75kg male, 175cm, age 30,
// moderate activity, cut goal -> ~2106 kcal, ~165g protein, not clamped.
Deno.test("PRD regression: 75kg male, moderate activity, cut -> 2106 kcal / 165g protein", () => {
  const result = generateCalorieAndMacroTargets({
    sex: "male",
    age: 30,
    heightCm: 175,
    weightKg: 75,
    activityLevel: "moderate",
    goal: "cut",
  });

  assertEquals(result.bmr, 1699);
  assertEquals(result.tdee, 2633);
  assertEquals(result.calories, 2106);
  assertEquals(result.proteinG, 165);
  assertEquals(result.wasFloorClamped, false);
  assertEquals(result.clampReason, undefined);
});

// A light, low-BMR individual selecting the most aggressive cut should be
// clamped to the flat safe floor (1200 kcal for female) rather than allowed
// to fall below it, with an explicit reason surfaced for the UI.
Deno.test("applyGoalAndFloor clamps to the safe floor and explains why", () => {
  const bmr = 1150; // e.g. small-frame female, low activity
  const tdee = bmr * 1.2; // sedentary
  const { calories, wasFloorClamped, clampReason } = applyGoalAndFloor(
    tdee,
    bmr,
    "female",
    "cut_aggressive"
  );

  assertEquals(wasFloorClamped, true);
  assertEquals(calories, 1200);
  assertMatch(clampReason ?? "", /safe minimum/i);
});

// Note: given the current ACTIVITY_MULTIPLIERS (min 1.2, sedentary) and
// GOAL_ADJUSTMENT_PCT (min 0.75x, cut_aggressive), the raw target can never
// fall strictly below 90% of BMR (1.2 * 0.75 = 0.9 exactly) -- so the
// "90% of BMR" clamp branch is unreachable with today's constants. Flagging
// this as an observation on the shipped reference implementation rather than
// changing it, since calorieEngine.ts is specified verbatim by the PRD.
Deno.test("applyGoalAndFloor: BMR-floor branch is at most a boundary, never a strict clamp, given current constants", () => {
  const bmr = 3000; // deliberately high BMR to try to trigger the bmrFloor > safeFloor branch
  const tdee = bmr * 1.2; // sedentary (lowest activity multiplier)
  const { wasFloorClamped } = applyGoalAndFloor(tdee, bmr, "male", "cut_aggressive");

  // raw = bmr * 1.2 * 0.75 = bmr * 0.9 = bmrFloor exactly -> not "<", so never clamped here.
  assertEquals(wasFloorClamped, false);
});

// A contrived but valid input (very high bodyweight at floor-level calories)
// where protein_kcal + fat_kcal alone would exceed the calorie target --
// carbs must floor at 0 rather than go negative, per PRD 8.2.
Deno.test("calculateMacros rebalances protein instead of letting carbs go negative", () => {
  const macros = calculateMacros(1500, 128, "cut_aggressive");

  assertEquals(macros.carbsG, 0);
  assertEquals(macros.fatG, Math.round((1500 * 0.25) / 9));
  // proteinKcal should have been scaled down to exactly fill the remaining calories after fat
  const expectedProteinG = Math.round((1500 - 1500 * 0.25) / 4);
  assertEquals(macros.proteinG, expectedProteinG);
});

Deno.test("distributeMeals respects a custom meal split", () => {
  const macros = { calories: 2000, proteinG: 150, fatG: 55, carbsG: 220 };
  const customSplit = { breakfast: 0.3, lunch: 0.3, dinner: 0.3, snack: 0.1 };

  const plan = distributeMeals(macros, customSplit);
  const breakfast = plan.find((m) => m.meal === "breakfast");

  assertEquals(breakfast?.targetCalories, Math.round(2000 * 0.3));
});

Deno.test("distributeMeals rejects a split that doesn't sum to 1.0", () => {
  const macros = { calories: 2000, proteinG: 150, fatG: 55, carbsG: 220 };
  const badSplit = { breakfast: 0.3, lunch: 0.3, dinner: 0.3, snack: 0.3 };

  let threw = false;
  try {
    distributeMeals(macros, badSplit);
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});
