// FITTAYI photo-based meal logging — prompt construction + deterministic math.
// Pure functions, no I/O — unit test this in isolation, same as
// calorieEngine.ts / dishSelection.ts.
//
// Architecture (PRD 6.5, fittayi-handoff-2026-09-15/): Claude does NOT
// compute calories. It only matches each visible item to a dish and
// estimates a portion multiplier; the app computes final macros
// deterministically (stored value x multiplier). This is the same
// prompt/schema as fittayi-handoff-2026-09-15/plate-check.html and
// food_calorie_estimator.py — those two now agree with each other (an
// earlier version of the Python reference implementation had Claude
// computing absolute calories directly, which contradicted this; fixed
// 2026-09-15).

export interface DishVocabEntry {
  id: string;
  name: string;
  serving_size: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
}

export interface UnmatchedEstimate {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

export interface ModelItem {
  matched_dish_id: string | null;
  seen_as: string;
  portion_multiplier: number | null;
  reference_used: string;
  confidence: "high" | "medium" | "low";
  unmatched_estimate: UnmatchedEstimate | null;
}

export interface ModelResponse {
  items: ModelItem[];
  overall_confidence: "high" | "medium" | "low";
  notes: string;
}

export interface ComputedMacros {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

const RESPONSE_SCHEMA_INSTRUCTIONS = `Reply with ONLY a JSON object, no markdown fences, no text outside the JSON, matching exactly:
{
  "items": [
    {"matched_dish_id": string|null, "seen_as": string, "portion_multiplier": number|null,
"reference_used": string, "confidence": "high"|"medium"|"low",
"unmatched_estimate": {"calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "fiber_g": number}|null}
  ],
  "overall_confidence": "high"|"medium"|"low",
  "notes": string
}`;

// Builds the vision prompt from a LIVE dish list (the caller queries the
// real `dishes` table) — never hardcode the vocabulary, or it drifts out of
// sync with the catalog. Full-catalog vocabulary (not pre-filtered by meal
// slot), per product decision 2026-09-15.
export function buildMealPhotoPrompt(dishes: DishVocabEntry[]): string {
  const vocabLines = dishes
    .map((d) => `- id "${d.id}": ${d.name}, standard serving = ${d.serving_size ?? "1 serving"}`)
    .join("\n");

  return (
    "You are a nutrition-logging assistant inside a fitness app with a Kerala-first Indian user base. " +
    "Do NOT calculate calories yourself for known dishes — your job is to identify each food item and judge its " +
    "portion size, so the app can look up real numbers from its own dish database.\n\n" +
    "DISH DATABASE (match against these first):\n" +
    vocabLines +
    "\n\n" +
    "You are shown one photo of a meal. For each distinct food item visible:\n" +
    "1. Try to match it to one dish id above. Use matched_dish_id for that id, or null if nothing above genuinely fits " +
    "(don't force a bad match — a wrong match is worse than \"no match\").\n" +
    "2. If matched, estimate portion_multiplier: how the visible amount compares to that dish's standard serving " +
    "(1.0 = standard serving, 0.5 = half, 2 = double). Look for a real-world size reference in the photo (a steel " +
    "plate ~26-28cm, a katori/bowl ~150-300ml, a spoon, a hand, a banana leaf) and name it in reference_used.\n" +
    "3. If NOT matched, leave portion_multiplier null and instead fill unmatched_estimate with your own " +
    "first-principles calorie/macro guess for the amount visible (this is a rough fallback, not a database lookup).\n" +
    '4. Give seen_as: a short human description of what you saw (e.g. "3 medium idlis", "small bowl of green chutney powder").\n' +
    "5. Rate confidence high/medium/low per item — be honest: low when the photo is unclear, portion is hard to judge, " +
    "items are stacked/mixed, or a condiment bowl's eaten amount is unpredictable.\n" +
    "6. Never refuse to estimate.\n\n" +
    RESPONSE_SCHEMA_INSTRUCTIONS
  );
}

// Deterministic math — this is the part that never asks Claude. Mirrors
// plate-check.html's computeItemMacros() / food_calorie_estimator.py's
// compute_item_macros() exactly, so all three agree.
export function computeItemMacros(
  item: ModelItem,
  dishById: Map<string, DishVocabEntry>
): ComputedMacros {
  if (item.matched_dish_id) {
    const dish = dishById.get(item.matched_dish_id);
    if (dish) {
      const m = item.portion_multiplier ?? 1;
      return {
        calories: dish.calories * m,
        protein_g: dish.protein_g * m,
        carbs_g: dish.carbs_g * m,
        fat_g: dish.fat_g * m,
        fiber_g: (dish.fiber_g ?? 0) * m,
      };
    }
  }
  if (item.unmatched_estimate) return item.unmatched_estimate;
  return { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
}

export function sumMacros(items: ComputedMacros[]): ComputedMacros {
  return items.reduce(
    (t, m) => ({
      calories: t.calories + m.calories,
      protein_g: t.protein_g + m.protein_g,
      carbs_g: t.carbs_g + m.carbs_g,
      fat_g: t.fat_g + m.fat_g,
      fiber_g: t.fiber_g + m.fiber_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }
  );
}

// A matched_dish_id the model returns must be validated against the live
// vocabulary it was actually given — never trust it blindly. A hallucinated
// or stale id is treated exactly like an explicit null match.
export function sanitizeModelItem(raw: unknown, dishById: Map<string, DishVocabEntry>): ModelItem | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.seen_as !== "string") return null;

  const rawId = typeof r.matched_dish_id === "string" ? r.matched_dish_id : null;
  const matchedId = rawId && dishById.has(rawId) ? rawId : null;

  const confidence =
    r.confidence === "high" || r.confidence === "low" ? r.confidence : "medium";

  return {
    matched_dish_id: matchedId,
    seen_as: r.seen_as,
    portion_multiplier:
      matchedId && typeof r.portion_multiplier === "number" ? r.portion_multiplier : matchedId ? 1 : null,
    reference_used: typeof r.reference_used === "string" ? r.reference_used : "",
    confidence,
    unmatched_estimate: !matchedId ? (r.unmatched_estimate as UnmatchedEstimate | null) ?? null : null,
  };
}
