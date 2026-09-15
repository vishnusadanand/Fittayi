export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Goal = "cut" | "cut_aggressive" | "maintain" | "build" | "recomp";
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
export type DietType = "veg" | "vegan" | "egg" | "non_veg";
export type Condition = "knee" | "back" | "wrist" | "none";

export interface QuizAnswers {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  dietType: DietType;
  allergens: string[];
  cuisineRegionPref: string;
  conditions: Condition[];
}

export interface CalorieResult {
  bmr: number;
  tdee: number;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  wasFloorClamped: boolean;
  clampReason?: string;
}

export interface MealPlanTarget {
  meal: MealSlot;
  targetCalories: number;
  targetProteinG: number;
  targetFatG: number;
  targetCarbsG: number;
}

export interface CalorieEngineResponse extends CalorieResult {
  mealPlan: MealPlanTarget[];
}

export interface Dish {
  id: string;
  name: string;
  diet_type: DietType;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  allergens: string[] | null;
}

export interface DishSelectionResponse {
  pick: Dish | null;
  alternates: Dish[];
}

export interface WeeklyPlanRow {
  user_id: string;
  plan_date: string;
  meal_slot: MealSlot;
  dish_id: string | null;
  target_calories: number;
  actual_calories: number | null;
}

// ---- Photo-based meal logging (PRD 6.5) ----

export interface ComputedMacros {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

export interface MealPhotoItem {
  matched_dish_id: string | null;
  seen_as: string;
  portion_multiplier: number | null;
  reference_used: string;
  confidence: "high" | "medium" | "low";
  unmatched_estimate: ComputedMacros | null;
  computed_macros: ComputedMacros;
}

export interface MealPhotoAnalysisResponse {
  items: MealPhotoItem[];
  totals: ComputedMacros;
  overall_confidence: "high" | "medium" | "low";
  notes: string;
}

// ---- Workout module (PRD 6.6) ----

export type WorkoutGoal = "fatloss" | "muscle" | "maintain";
export type ExerciseAnim =
  | "squat"
  | "jack"
  | "pushup"
  | "static"
  | "kneedrive"
  | "lunge"
  | "hiplift"
  | "twist"
  | "burpee";

// "none" is a UI-only sentinel (the condition selector's "no injuries"
// option) — no exercise is ever tagged with it, so exercise tags exclude it.
export type ExerciseTag = Exclude<Condition, "none">;

export interface Exercise {
  name: string;
  anim: ExerciseAnim;
  mode: "reps" | "time";
  target: number;
  tags: ExerciseTag[];
}

export interface RoutineExercise extends Exercise {
  id: string;
  swapped: boolean;
  originalName?: string;
}
