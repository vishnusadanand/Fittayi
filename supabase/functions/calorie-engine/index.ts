// FITTAYI calorie/macro engine — Edge Function
// Server-authoritative per PRD 6.1: never trust this computation from client
// input, so the safety floors can't be bypassed by a modified UI request.
import { distributeMeals, generateCalorieAndMacroTargets } from "../_shared/calorieEngine.ts";
import { getMealSplit } from "../_shared/mealSplit.ts";
import { validateUserInputs } from "../_shared/validateInputs.ts";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const validation = validateUserInputs(body);
  if (!validation.ok) {
    return jsonResponse({ error: validation.error }, 400);
  }

  const result = generateCalorieAndMacroTargets(validation.inputs);
  const mealSplit = await getMealSplit();
  const mealPlan = distributeMeals(result, mealSplit);

  return jsonResponse({ ...result, mealPlan }, 200);
});
