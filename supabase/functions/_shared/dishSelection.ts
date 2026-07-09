export type DietType = "veg" | "vegan" | "egg" | "non_veg";

export interface CandidateDish {
  id: string;
  name: string;
  diet_type: DietType;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  allergens: string[] | null;
}

// See Phase 3 plan: a user's diet preference determines what they CAN eat,
// not an exact tag match. vegan < veg < egg < non_veg, each including
// everything below it.
const DIET_HIERARCHY: Record<DietType, DietType[]> = {
  vegan: ["vegan"],
  veg: ["vegan", "veg"],
  egg: ["vegan", "veg", "egg"],
  non_veg: ["vegan", "veg", "egg", "non_veg"],
};

export function dietCompatibleTypes(userDietType: DietType): DietType[] {
  return DIET_HIERARCHY[userDietType];
}

export function withinCalorieTolerance(
  calories: number,
  targetCalories: number,
  tolerancePct = 0.1
): boolean {
  const lower = targetCalories * (1 - tolerancePct);
  const upper = targetCalories * (1 + tolerancePct);
  return calories >= lower && calories <= upper;
}

export function hasExcludedAllergen(
  dishAllergens: string[] | null,
  userAllergens: string[]
): boolean {
  if (!dishAllergens || dishAllergens.length === 0 || userAllergens.length === 0) {
    return false;
  }
  const userSet = new Set(userAllergens.map((a) => a.toLowerCase()));
  return dishAllergens.some((a) => userSet.has(a.toLowerCase()));
}

// Ascending by |protein_g - target|; ties broken by closeness to target calories
// so the result is deterministic rather than depending on DB row order.
export function rankByProteinCloseness<T extends CandidateDish>(
  dishes: T[],
  targetProteinG: number,
  targetCalories: number
): T[] {
  return [...dishes].sort((a, b) => {
    const proteinDiff = Math.abs(a.protein_g - targetProteinG) - Math.abs(b.protein_g - targetProteinG);
    if (proteinDiff !== 0) return proteinDiff;
    return Math.abs(a.calories - targetCalories) - Math.abs(b.calories - targetCalories);
  });
}
