import { supabase } from "./supabaseClient";
import { generateWeeklyPlan } from "./api";
import type { QuizAnswers } from "../types/fittayi";

const STORAGE_KEY = "fittayi_quiz_answers";

// If the user completed the quiz before signing up, this saves their
// answers into user_profiles and generates the first weekly plan. Called
// once a real session exists (right after signup if email confirmation is
// off, or after login once they've confirmed).
export async function completeSignupIfPending(): Promise<void> {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const answers = JSON.parse(raw) as QuizAnswers;

  const { error } = await supabase.from("user_profiles").upsert(
    {
      user_id: user.id,
      sex: answers.sex,
      age: answers.age,
      height_cm: answers.heightCm,
      weight_kg: answers.weightKg,
      activity_level: answers.activityLevel,
      goal: answers.goal,
      diet_type: answers.dietType,
      allergens: answers.allergens,
      cuisine_region_pref: answers.cuisineRegionPref,
    },
    { onConflict: "user_id" }
  );

  if (!error) {
    sessionStorage.removeItem(STORAGE_KEY);
    await generateWeeklyPlan();
  }
}
