import { supabase } from "./supabaseClient";
import type {
  CalorieEngineResponse,
  DietType,
  DishSelectionResponse,
  MealPhotoAnalysisResponse,
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

export function analyzeMealPhoto(storagePath: string): Promise<MealPhotoAnalysisResponse> {
  return callFunction<MealPhotoAnalysisResponse>("photo-analysis", { storagePath });
}

const EXT_BY_MEDIA_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Uploads to the user's own folder in the meal-photos bucket (RLS requires
// this exact prefix — see supabase/migrations/20260915000003_meal_photos_storage.sql)
// and returns the storage path to pass to analyzeMealPhoto.
export async function uploadMealPhoto(file: File): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required to log a meal.");

  // Prefer the browser-reported MIME type — file.name.split(".").pop() never
  // actually falls through to a default (split() always returns a non-empty
  // array), so a filename with no dot silently became the "extension"
  // before this fix. photo-analysis's own media-type check now primarily
  // trusts the uploaded Blob's real .type too, so this mainly just keeps
  // the stored object's name sensible.
  const ext = EXT_BY_MEDIA_TYPE[file.type] ?? file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from("meal-photos").upload(path, file);
  if (error) throw new Error(error.message);

  return path;
}
