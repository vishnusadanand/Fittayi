import { assertEquals, assertStringIncludes } from "jsr:@std/assert";
import {
  buildMealPhotoPrompt,
  computeItemMacros,
  sanitizeModelItem,
  sumMacros,
  type DishVocabEntry,
  type ModelItem,
} from "./mealPhotoAnalysis.ts";

const IDLI: DishVocabEntry = {
  id: "dish-1",
  name: "Idli",
  serving_size: "1 medium (~40g)",
  calories: 58,
  protein_g: 2,
  carbs_g: 12,
  fat_g: 0.1,
  fiber_g: 0.5,
};
const DISH_BY_ID = new Map([[IDLI.id, IDLI]]);

Deno.test("buildMealPhotoPrompt: lists the live dish vocabulary, not a hardcoded one", () => {
  const prompt = buildMealPhotoPrompt([IDLI]);
  assertStringIncludes(prompt, 'id "dish-1": Idli, standard serving = 1 medium (~40g)');
  assertStringIncludes(prompt, "Do NOT calculate calories yourself");
  assertStringIncludes(prompt, "matched_dish_id");
});

Deno.test("computeItemMacros: matched item scales the stored dish value by the multiplier", () => {
  const item: ModelItem = {
    matched_dish_id: "dish-1",
    seen_as: "3 idlis",
    portion_multiplier: 3,
    reference_used: "katori bowl",
    confidence: "high",
    unmatched_estimate: null,
  };
  const macros = computeItemMacros(item, DISH_BY_ID);
  assertEquals(macros.calories, 174); // 58 * 3
  assertEquals(macros.protein_g, 6); // 2 * 3
});

Deno.test("computeItemMacros: unmatched item uses the model's one-off estimate, not a dish lookup", () => {
  const item: ModelItem = {
    matched_dish_id: null,
    seen_as: "unfamiliar chutney",
    portion_multiplier: null,
    reference_used: "",
    confidence: "low",
    unmatched_estimate: { calories: 45, protein_g: 1, carbs_g: 3, fat_g: 3, fiber_g: 1 },
  };
  assertEquals(computeItemMacros(item, DISH_BY_ID).calories, 45);
});

Deno.test("sumMacros: totals across items", () => {
  const total = sumMacros([
    { calories: 100, protein_g: 5, carbs_g: 10, fat_g: 2, fiber_g: 1 },
    { calories: 200, protein_g: 10, carbs_g: 20, fat_g: 4, fiber_g: 2 },
  ]);
  assertEquals(total, { calories: 300, protein_g: 15, carbs_g: 30, fat_g: 6, fiber_g: 3 });
});

Deno.test("sanitizeModelItem: a hallucinated dish id not in the live vocabulary is treated as unmatched", () => {
  const sanitized = sanitizeModelItem(
    { matched_dish_id: "dish-does-not-exist", seen_as: "something", portion_multiplier: 2, confidence: "high" },
    DISH_BY_ID
  );
  assertEquals(sanitized?.matched_dish_id, null);
  assertEquals(sanitized?.portion_multiplier, null);
});

Deno.test("sanitizeModelItem: a real dish id from the live vocabulary is accepted", () => {
  const sanitized = sanitizeModelItem(
    { matched_dish_id: "dish-1", seen_as: "idli", portion_multiplier: 2, confidence: "high" },
    DISH_BY_ID
  );
  assertEquals(sanitized?.matched_dish_id, "dish-1");
  assertEquals(sanitized?.portion_multiplier, 2);
});

Deno.test("sanitizeModelItem: missing seen_as makes the item invalid", () => {
  assertEquals(sanitizeModelItem({ matched_dish_id: "dish-1" }, DISH_BY_ID), null);
});

Deno.test("sanitizeModelItem: unrecognized confidence value defaults to medium rather than throwing", () => {
  const sanitized = sanitizeModelItem({ seen_as: "x", confidence: "extremely high" }, DISH_BY_ID);
  assertEquals(sanitized?.confidence, "medium");
});
