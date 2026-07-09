import { supabase } from "./supabaseClient";
import type {
  CalorieEngineResponse,
  DietType,
  DishSelectionResponse,
  MealSlot,
  QuizAnswers,
} from "../types/fittayi";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function authHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? (import.meta.env.VITE_SUPABASE_ANON_KEY as string);
  return `Bearer ${token}`;
}

async function callFunction<T>(name: string, body: unknown): Promise<T> {
  const response = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      Authorization: await authHeader(),
    },
    body: JSON.stringify(body),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error ?? `${name} request failed`);
  }
  return json as T;
}

export function computeCalorieTargets(answers: Pick<
  QuizAnswers,
  "sex" | "age" | "heightCm" | "weightKg" | "activityLevel" | "goal"
>): Promise<CalorieEngineResponse> {
  return callFunction<CalorieEngineResponse>("calorie-engine", answers);
}

export function selectDish(params: {
  mealSlot: MealSlot;
  targetCalories: number;
  targetProteinG: number;
  dietType: DietType;
  allergens: string[];
}): Promise<DishSelectionResponse> {
  return callFunction<DishSelectionResponse>("dish-selection", params);
}

export function generateWeeklyPlan(): Promise<{
  calorieResult: CalorieEngineResponse;
  mealPlanTargets: unknown;
  plan: unknown[];
}> {
  return callFunction("generate-weekly-plan", {});
}
