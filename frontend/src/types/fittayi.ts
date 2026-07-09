export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Goal = "cut" | "cut_aggressive" | "maintain" | "build" | "recomp";
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
export type DietType = "veg" | "vegan" | "egg" | "non_veg";

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
