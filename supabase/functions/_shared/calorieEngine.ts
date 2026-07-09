// calorieEngine.ts
// Core calorie/macro allocation logic for FITTAYI.
// Pure functions, no I/O — unit test this in isolation from the UI/DB layer.
//
// This is the reference implementation from the FITTAYI PRD, copied verbatim
// (no behavior changes) except that DEFAULT_MEAL_SPLIT is now an exported
// fallback rather than baked into distributeMeals — the caller (the Edge
// Function's index.ts) is responsible for reading the configurable
// meal_split_config table per PRD 6.1 and falling back to this constant only
// if that read fails.

export type Sex = "male" | "female";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";
export type Goal = "cut" | "cut_aggressive" | "maintain" | "build" | "recomp";
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export interface UserInputs {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
}

export interface MacroTargets {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export interface CalorieResult extends MacroTargets {
  bmr: number;
  tdee: number;
  wasFloorClamped: boolean;
  clampReason?: string;
}

export interface MealPlanTargets {
  meal: MealSlot;
  targetCalories: number;
  targetProteinG: number;
  targetFatG: number;
  targetCarbsG: number;
}

// ---- Constants ----

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_ADJUSTMENT_PCT: Record<Goal, number> = {
  cut: -0.2,
  cut_aggressive: -0.25,
  maintain: 0,
  build: 0.1,
  recomp: -0.05,
};

const PROTEIN_G_PER_KG: Record<Goal, number> = {
  cut: 2.2,
  cut_aggressive: 2.2,
  maintain: 1.6,
  build: 1.8,
  recomp: 2.0,
};

const FAT_PCT_OF_CALORIES = 0.25;

const SAFE_FLOOR_KCAL: Record<Sex, number> = {
  male: 1500,
  female: 1200,
};

// Fallback meal distribution if the meal_split_config table can't be read.
// PRD 6.1: "must be stored as a configurable table, not hardcoded" — the
// live source of truth is the DB table; this is only a last-resort default.
export const DEFAULT_MEAL_SPLIT: Record<MealSlot, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.3,
  snack: 0.1,
};

// ---- Step 1: BMR (Mifflin-St Jeor) ----

export function calculateBMR(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

// ---- Step 2: TDEE ----

export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return bmr * ACTIVITY_MULTIPLIERS[activityLevel];
}

// ---- Step 3 & 4: Goal adjustment + safety floor clamping ----

export function applyGoalAndFloor(
  tdee: number,
  bmr: number,
  sex: Sex,
  goal: Goal
): { calories: number; wasFloorClamped: boolean; clampReason?: string } {
  const rawTarget = tdee * (1 + GOAL_ADJUSTMENT_PCT[goal]);

  const safeFloor = SAFE_FLOOR_KCAL[sex];
  const bmrFloor = bmr * 0.9;
  const hardFloor = Math.max(safeFloor, bmrFloor);

  if (rawTarget < hardFloor) {
    const reason =
      bmrFloor > safeFloor
        ? `Raw target (${Math.round(rawTarget)} kcal) fell below 90% of BMR (${Math.round(bmrFloor)} kcal).`
        : `Raw target (${Math.round(rawTarget)} kcal) fell below the safe minimum for this user (${safeFloor} kcal).`;
    return { calories: Math.round(hardFloor), wasFloorClamped: true, clampReason: reason };
  }

  return { calories: Math.round(rawTarget), wasFloorClamped: false };
}

// ---- Step 5: Macro allocation ----

export function calculateMacros(calories: number, weightKg: number, goal: Goal): MacroTargets {
  let proteinG = weightKg * PROTEIN_G_PER_KG[goal];
  let proteinKcal = proteinG * 4;

  const fatKcal = calories * FAT_PCT_OF_CALORIES;
  const fatG = fatKcal / 9;

  let carbsKcal = calories - proteinKcal - fatKcal;

  // Safety net: if protein + fat alone exceed the calorie target
  // (can happen at low calories + high bodyweight), scale protein back
  // rather than letting carbs go negative.
  if (carbsKcal < 0) {
    proteinKcal = calories - fatKcal;
    proteinG = proteinKcal / 4;
    carbsKcal = 0;
  }

  const carbsG = carbsKcal / 4;

  return {
    calories: Math.round(calories),
    proteinG: Math.round(proteinG),
    fatG: Math.round(fatG),
    carbsG: Math.round(carbsG),
  };
}

// ---- Step 6: Distribute across meals ----

export function distributeMeals(
  macros: MacroTargets,
  mealSplit: Record<MealSlot, number> = DEFAULT_MEAL_SPLIT
): MealPlanTargets[] {
  const slots = Object.keys(mealSplit) as MealSlot[];

  const total = slots.reduce((sum, slot) => sum + mealSplit[slot], 0);
  if (Math.abs(total - 1) > 0.01) {
    throw new Error(`Meal split percentages must sum to 1.0, got ${total}`);
  }

  return slots.map((meal) => {
    const pct = mealSplit[meal];
    return {
      meal,
      targetCalories: Math.round(macros.calories * pct),
      targetProteinG: Math.round(macros.proteinG * pct),
      targetFatG: Math.round(macros.fatG * pct),
      targetCarbsG: Math.round(macros.carbsG * pct),
    };
  });
}

// ---- Orchestrator: run the full pipeline from raw inputs ----

export function generateCalorieAndMacroTargets(inputs: UserInputs): CalorieResult {
  const bmr = calculateBMR(inputs.sex, inputs.weightKg, inputs.heightCm, inputs.age);
  const tdee = calculateTDEE(bmr, inputs.activityLevel);
  const { calories, wasFloorClamped, clampReason } = applyGoalAndFloor(
    tdee,
    bmr,
    inputs.sex,
    inputs.goal
  );
  const macros = calculateMacros(calories, inputs.weightKg, inputs.goal);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    ...macros,
    wasFloorClamped,
    clampReason,
  };
}
