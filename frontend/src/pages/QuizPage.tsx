import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { computeCalorieTargets, selectDish } from "../lib/api";
import { Disclaimer } from "../components/Disclaimer";
import { FloorClampBanner } from "../components/FloorClampBanner";
import type {
  ActivityLevel,
  CalorieEngineResponse,
  DietType,
  Dish,
  Goal,
  MealSlot,
  QuizAnswers,
  Sex,
} from "../types/fittayi";

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: "sedentary", label: "Sedentary (little to no exercise)" },
  { value: "light", label: "Light (exercise 1-3 days/week)" },
  { value: "moderate", label: "Moderate (exercise 3-5 days/week)" },
  { value: "active", label: "Active (exercise 6-7 days/week)" },
  { value: "very_active", label: "Very active (hard daily training)" },
];

const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: "cut", label: "Cut — lose fat" },
  { value: "cut_aggressive", label: "Cut (aggressive)" },
  { value: "maintain", label: "Maintain" },
  { value: "build", label: "Build — gain muscle" },
  { value: "recomp", label: "Recomp — lose fat and build muscle together" },
];

const DIET_OPTIONS: { value: DietType; label: string }[] = [
  { value: "vegan", label: "Vegan" },
  { value: "veg", label: "Vegetarian" },
  { value: "egg", label: "Eggetarian" },
  { value: "non_veg", label: "Non-vegetarian" },
];

const ALLERGEN_OPTIONS = ["milk", "egg", "fish", "shellfish", "mollusk", "peanut", "gluten", "soy", "nuts"];

const CUISINE_OPTIONS = ["Kerala / South Indian (recommended)", "Pan-India", "No preference"];

const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

type Step =
  | "sex"
  | "age"
  | "height"
  | "weight"
  | "activity"
  | "goal"
  | "diet"
  | "allergens"
  | "cuisine"
  | "screening"
  | "result"
  | "blocked";

const STEP_ORDER: Step[] = [
  "sex",
  "age",
  "height",
  "weight",
  "activity",
  "goal",
  "diet",
  "allergens",
  "cuisine",
  "screening",
];

export function QuizPage() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [step, setStep] = useState<Step>("sex");
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({ allergens: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calorieResult, setCalorieResult] = useState<CalorieEngineResponse | null>(null);
  const [samplePlan, setSamplePlan] = useState<{ slot: MealSlot; dish: Dish | null }[]>([]);

  function goToNext(patch: Partial<QuizAnswers>) {
    const updated = { ...answers, ...patch };
    setAnswers(updated);
    const nextIndex = stepIndex + 1;
    if (nextIndex < STEP_ORDER.length) {
      setStepIndex(nextIndex);
      setStep(STEP_ORDER[nextIndex]);
    }
  }

  async function handleScreening(passed: boolean) {
    if (!passed) {
      setStep("blocked");
      return;
    }
    await generateSamplePlan();
  }

  async function generateSamplePlan() {
    setLoading(true);
    setError(null);
    try {
      const full = answers as QuizAnswers;
      const result = await computeCalorieTargets({
        sex: full.sex,
        age: full.age,
        heightCm: full.heightCm,
        weightKg: full.weightKg,
        activityLevel: full.activityLevel,
        goal: full.goal,
      });
      setCalorieResult(result);

      const picks = await Promise.all(
        result.mealPlan.map(async (target) => {
          const res = await selectDish({
            mealSlot: target.meal,
            targetCalories: target.targetCalories,
            targetProteinG: target.targetProteinG,
            dietType: full.dietType,
            allergens: full.allergens,
          });
          return { slot: target.meal, dish: res.pick };
        })
      );
      setSamplePlan(picks);
      sessionStorage.setItem("fittayi_quiz_answers", JSON.stringify(full));
      setStep("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong generating your plan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      {step !== "result" && step !== "blocked" && (
        <div className="mb-8">
          <div className="h-1 w-full rounded-full bg-neutral-200 dark:bg-neutral-800">
            <div
              className="h-1 rounded-full bg-brand-600 transition-all"
              style={{ width: `${((stepIndex + 1) / STEP_ORDER.length) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Question {stepIndex + 1} of {STEP_ORDER.length}
          </p>
        </div>
      )}

      {step === "sex" && (
        <QuestionCard title="What's your sex?">
          <OptionButtons
            options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }]}
            onSelect={(v) => goToNext({ sex: v as Sex })}
          />
        </QuestionCard>
      )}

      {step === "age" && (
        <NumberQuestion
          title="How old are you?"
          suffix="years"
          min={13}
          max={100}
          onSubmit={(v) => goToNext({ age: v })}
        />
      )}

      {step === "height" && (
        <NumberQuestion
          title="What's your height?"
          suffix="cm"
          min={100}
          max={250}
          onSubmit={(v) => goToNext({ heightCm: v })}
        />
      )}

      {step === "weight" && (
        <NumberQuestion
          title="What's your current weight?"
          suffix="kg"
          min={30}
          max={300}
          onSubmit={(v) => goToNext({ weightKg: v })}
        />
      )}

      {step === "activity" && (
        <QuestionCard title="How active are you day to day?">
          <OptionButtons options={ACTIVITY_OPTIONS} onSelect={(v) => goToNext({ activityLevel: v as ActivityLevel })} />
        </QuestionCard>
      )}

      {step === "goal" && (
        <QuestionCard title="What's your goal?">
          <OptionButtons options={GOAL_OPTIONS} onSelect={(v) => goToNext({ goal: v as Goal })} />
        </QuestionCard>
      )}

      {step === "diet" && (
        <QuestionCard title="What do you eat?">
          <OptionButtons options={DIET_OPTIONS} onSelect={(v) => goToNext({ dietType: v as DietType })} />
        </QuestionCard>
      )}

      {step === "allergens" && (
        <AllergenQuestion onSubmit={(v) => goToNext({ allergens: v })} />
      )}

      {step === "cuisine" && (
        <QuestionCard title="Any cuisine preference?">
          <OptionButtons
            options={CUISINE_OPTIONS.map((c) => ({ value: c, label: c }))}
            onSelect={(v) => goToNext({ cuisineRegionPref: v })}
          />
        </QuestionCard>
      )}

      {step === "screening" && (
        <ScreeningQuestion age={answers.age ?? 0} onAnswer={handleScreening} />
      )}

      {loading && <p className="text-center text-sm text-neutral-500">Building your plan...</p>}
      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      {step === "blocked" && <BlockedScreen />}

      {step === "result" && calorieResult && (
        <SampleResult
          calorieResult={calorieResult}
          samplePlan={samplePlan}
          onSignup={() => navigate("/signup")}
        />
      )}

      <Disclaimer className="mt-12 text-center" />
    </div>
  );
}

function QuestionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function OptionButtons({
  options,
  onSelect,
}: {
  options: { value: string; label: string }[];
  onSelect: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onSelect(opt.value)}
          className="rounded-lg border border-neutral-200 px-4 py-3 text-left hover:border-brand-500 hover:bg-brand-50 dark:border-neutral-800 dark:hover:bg-brand-950"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function NumberQuestion({
  title,
  suffix,
  min,
  max,
  onSubmit,
}: {
  title: string;
  suffix: string;
  min: number;
  max: number;
  onSubmit: (value: number) => void;
}) {
  const [value, setValue] = useState<string>("");
  const numeric = Number(value);
  const valid = value !== "" && !Number.isNaN(numeric) && numeric >= min && numeric <= max;

  return (
    <QuestionCard title={title}>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-32 rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          autoFocus
        />
        <span className="text-neutral-500">{suffix}</span>
      </div>
      <button
        disabled={!valid}
        onClick={() => onSubmit(numeric)}
        className="mt-6 rounded-full bg-brand-600 px-6 py-2 font-medium text-white disabled:opacity-40"
      >
        Next
      </button>
    </QuestionCard>
  );
}

function AllergenQuestion({ onSubmit }: { onSubmit: (allergens: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(allergen: string) {
    setSelected((prev) =>
      prev.includes(allergen) ? prev.filter((a) => a !== allergen) : [...prev, allergen]
    );
  }

  return (
    <QuestionCard title="Any allergens to avoid? (select all that apply)">
      <div className="flex flex-wrap gap-2">
        {ALLERGEN_OPTIONS.map((allergen) => (
          <button
            key={allergen}
            onClick={() => toggle(allergen)}
            className={`rounded-full border px-4 py-2 text-sm capitalize ${
              selected.includes(allergen)
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-neutral-300 dark:border-neutral-700"
            }`}
          >
            {allergen}
          </button>
        ))}
      </div>
      <button
        onClick={() => onSubmit(selected)}
        className="mt-6 rounded-full bg-brand-600 px-6 py-2 font-medium text-white"
      >
        {selected.length === 0 ? "None of these — Next" : "Next"}
      </button>
    </QuestionCard>
  );
}

function ScreeningQuestion({ age, onAnswer }: { age: number; onAnswer: (passed: boolean) => void }) {
  if (age < 18) {
    // Under-18 is determined from the age question already answered; no
    // separate question needed, but we still show why we're stopping here.
    return <BlockedScreen reason="age" />;
  }

  return (
    <QuestionCard title="Have you ever been diagnosed with an eating disorder?">
      <p className="mb-4 text-sm text-neutral-500">
        We ask this so we don't generate a restrictive calorie plan for someone it could harm.
      </p>
      <OptionButtons
        options={[
          { value: "no", label: "No" },
          { value: "yes", label: "Yes" },
        ]}
        onSelect={(v) => onAnswer(v !== "yes")}
      />
    </QuestionCard>
  );
}

function BlockedScreen({ reason }: { reason?: "age" | "ed" }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
      <h2 className="text-xl font-semibold">We can't generate a plan for you right now</h2>
      <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
        {reason === "age"
          ? "FITTAYI is built for adults (18+). If you're looking for nutrition guidance, please talk to a parent/guardian, your school counselor, or a pediatrician."
          : "FITTAYI's calorie-restricted plans aren't appropriate for anyone with a history of disordered eating. This isn't a judgment — it's a safety limit we hold for everyone."}
      </p>
      <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
        If you'd like to talk to someone, NIMHANS' toll-free helpline (080-46110007) and iCall
        (9152987821, icallhelpline.org) both offer free, confidential support in India.
      </p>
    </div>
  );
}

function SampleResult({
  calorieResult,
  samplePlan,
  onSignup,
}: {
  calorieResult: CalorieEngineResponse;
  samplePlan: { slot: MealSlot; dish: Dish | null }[];
  onSignup: () => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold">Your sample day</h2>

      {calorieResult.wasFloorClamped && (
        <FloorClampBanner clampReason={calorieResult.clampReason} />
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Calories" value={calorieResult.calories} />
        <Stat label="Protein" value={`${calorieResult.proteinG}g`} />
        <Stat label="Carbs" value={`${calorieResult.carbsG}g`} />
        <Stat label="Fat" value={`${calorieResult.fatG}g`} />
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {samplePlan.map(({ slot, dish }) => (
          <div key={slot} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <p className="text-xs font-semibold uppercase text-neutral-500">{MEAL_SLOT_LABELS[slot]}</p>
            {dish ? (
              <>
                <p className="mt-1 font-medium">{dish.name}</p>
                <p className="text-sm text-neutral-500">
                  {dish.calories} kcal &middot; {dish.protein_g}g protein
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-neutral-500">No match found in our catalog yet for this slot.</p>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={onSignup}
        className="mt-8 w-full rounded-full bg-brand-600 px-6 py-3 font-semibold text-white"
      >
        Sign up for your full week
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-3 text-center dark:border-neutral-800">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-neutral-500">{label}</div>
    </div>
  );
}
