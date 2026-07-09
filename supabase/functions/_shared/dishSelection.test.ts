import { assertEquals } from "jsr:@std/assert";
import {
  dietCompatibleTypes,
  hasExcludedAllergen,
  rankByProteinCloseness,
  withinCalorieTolerance,
  type CandidateDish,
} from "./dishSelection.ts";

Deno.test("dietCompatibleTypes: hierarchy includes everything below the user's preference", () => {
  assertEquals(dietCompatibleTypes("vegan"), ["vegan"]);
  assertEquals(dietCompatibleTypes("veg"), ["vegan", "veg"]);
  assertEquals(dietCompatibleTypes("egg"), ["vegan", "veg", "egg"]);
  assertEquals(dietCompatibleTypes("non_veg"), ["vegan", "veg", "egg", "non_veg"]);
});

Deno.test("withinCalorieTolerance: accepts the +/-10% band edges, rejects outside it", () => {
  assertEquals(withinCalorieTolerance(450, 500), true); // -10% exactly
  assertEquals(withinCalorieTolerance(550, 500), true); // +10% exactly
  assertEquals(withinCalorieTolerance(449, 500), false);
  assertEquals(withinCalorieTolerance(551, 500), false);
});

Deno.test("hasExcludedAllergen: case-insensitive overlap, no false positive when either list is empty", () => {
  assertEquals(hasExcludedAllergen(["Egg", "Gluten"], ["egg"]), true);
  assertEquals(hasExcludedAllergen(["fish"], ["peanut"]), false);
  assertEquals(hasExcludedAllergen(null, ["peanut"]), false);
  assertEquals(hasExcludedAllergen(["peanut"], []), false);
});

Deno.test("rankByProteinCloseness: sorts ascending by protein distance, ties broken by calorie distance", () => {
  const dishes: CandidateDish[] = [
    { id: "a", name: "A", diet_type: "veg", calories: 500, protein_g: 10, carbs_g: 0, fat_g: 0, allergens: [] },
    { id: "b", name: "B", diet_type: "veg", calories: 500, protein_g: 20, carbs_g: 0, fat_g: 0, allergens: [] },
    { id: "c", name: "C", diet_type: "veg", calories: 480, protein_g: 20, carbs_g: 0, fat_g: 0, allergens: [] },
  ];

  const ranked = rankByProteinCloseness(dishes, 20, 500);
  // b and c are both exactly on-target for protein (20g diff = 0), tiebreak by
  // calorie closeness: b is exactly on target calories (diff 0), c is 20 off.
  assertEquals(ranked[0].id, "b");
  assertEquals(ranked[1].id, "c");
  assertEquals(ranked[2].id, "a"); // protein diff 10 -> last
});
