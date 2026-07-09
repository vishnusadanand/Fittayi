import type { ActivityLevel, Goal, Sex, UserInputs } from "./calorieEngine.ts";

const SEXES: Sex[] = ["male", "female"];
const ACTIVITY_LEVELS: ActivityLevel[] = ["sedentary", "light", "moderate", "active", "very_active"];
const GOALS: Goal[] = ["cut", "cut_aggressive", "maintain", "build", "recomp"];

export type ValidationResult =
  | { ok: true; inputs: UserInputs }
  | { ok: false; error: string };

// Bounds match the user_profiles table CHECK constraints (see migration
// 20260709000001_initial_schema.sql) so client and DB agree on valid ranges.
export function validateUserInputs(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;

  if (!SEXES.includes(b.sex as Sex)) {
    return { ok: false, error: `sex must be one of: ${SEXES.join(", ")}` };
  }
  if (typeof b.age !== "number" || b.age < 13 || b.age > 100) {
    return { ok: false, error: "age must be a number between 13 and 100." };
  }
  if (typeof b.heightCm !== "number" || b.heightCm < 100 || b.heightCm > 250) {
    return { ok: false, error: "heightCm must be a number between 100 and 250." };
  }
  if (typeof b.weightKg !== "number" || b.weightKg < 30 || b.weightKg > 300) {
    return { ok: false, error: "weightKg must be a number between 30 and 300." };
  }
  if (!ACTIVITY_LEVELS.includes(b.activityLevel as ActivityLevel)) {
    return { ok: false, error: `activityLevel must be one of: ${ACTIVITY_LEVELS.join(", ")}` };
  }
  if (!GOALS.includes(b.goal as Goal)) {
    return { ok: false, error: `goal must be one of: ${GOALS.join(", ")}` };
  }

  return {
    ok: true,
    inputs: {
      sex: b.sex as Sex,
      age: b.age as number,
      heightCm: b.heightCm as number,
      weightKg: b.weightKg as number,
      activityLevel: b.activityLevel as ActivityLevel,
      goal: b.goal as Goal,
    },
  };
}
