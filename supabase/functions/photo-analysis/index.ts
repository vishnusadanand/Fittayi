// FITTAYI photo-based meal logging — Edge Function (PRD 6.5).
//
// Flow: client uploads a photo to the meal-photos Storage bucket first
// (RLS'd per user), then calls this function with just the storage path.
// This function downloads the photo server-side, builds the vision prompt
// from the LIVE dishes table (full catalog, not pre-filtered by meal slot —
// product decision 2026-09-15), calls the Anthropic API, computes final
// macros deterministically, logs unmatched items for admin review, and
// returns items for the client's confirmation screen. It does NOT write to
// meal_logs itself — saving a confirmed log is a plain client-side insert
// against meal_logs once the user has reviewed/corrected the items, since
// RLS already scopes that write to the calling user and no secret is
// involved in that step.
//
// Calls the Anthropic Messages API directly via fetch rather than the
// @anthropic-ai/sdk npm package, to avoid pinning an SDK version in a Deno
// edge function for what is otherwise a single, stable REST call.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildMealPhotoPrompt,
  computeItemMacros,
  sanitizeModelItem,
  sumMacros,
  type DishVocabEntry,
  type ModelResponse,
} from "../_shared/mealPhotoAnalysis.ts";

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

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
// Same model as fittayi-handoff-2026-09-15/food_calorie_estimator.py —
// confirm this is still a valid/available model id before real deployment,
// swap to whichever Claude model the account has vision access to.
const MODEL = "claude-sonnet-4-5-20250929";
const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // matches plate-check.html's stated limit

const MEDIA_TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

interface RequestBody {
  storagePath: string;
}

function validateBody(body: unknown): { ok: true; value: RequestBody } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.storagePath !== "string" || b.storagePath.length === 0) {
    return { ok: false, error: "storagePath must be a non-empty string." };
  }
  return { ok: true, value: { storagePath: b.storagePath } };
}

// Anthropic API errors get a specific, honest message per failure mode —
// deliberately not reusing plate-check.html's sample()-capability error
// codes (not_granted, sampling_disabled, ...), which don't exist outside
// Claude's artifact sandbox and would never match a real API response.
function mapAnthropicError(status: number): string {
  switch (status) {
    case 400:
      return "That photo couldn't be analyzed — try a clearer JPEG, PNG, WebP, or GIF.";
    case 401:
      return "Photo analysis is misconfigured (invalid API credentials). Contact support.";
    case 413:
      return "That photo is too large — try a smaller image.";
    case 429:
      return "Too many requests right now — wait a moment and try again.";
    case 529:
    case 503:
      return "Photo analysis is temporarily overloaded — try again shortly.";
    default:
      return `Something went wrong analyzing this photo (status ${status}). Try again.`;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const validation = validateBody(body);
  if (!validation.ok) {
    return jsonResponse({ error: validation.error }, 400);
  }
  const { storagePath } = validation.value;

  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicApiKey) {
    return jsonResponse({ error: "Photo analysis is not configured on this server." }, 500);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  // Photo logging is a post-signup feature — unlike dish-selection, there is
  // no anonymous path here.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonResponse({ error: "Sign in required." }, 401);
  }

  // Storage RLS already scopes access to the caller's own folder, but check
  // explicitly here too so a path mismatch fails with a clear message
  // instead of an opaque storage error.
  if (!storagePath.startsWith(`${user.id}/`)) {
    return jsonResponse({ error: "storagePath must be within your own folder." }, 403);
  }

  const { data: imageBlob, error: downloadError } = await supabase.storage
    .from("meal-photos")
    .download(storagePath);
  if (downloadError || !imageBlob) {
    return jsonResponse({ error: "Couldn't read that photo from storage." }, 404);
  }
  if (imageBlob.size > MAX_IMAGE_BYTES) {
    return jsonResponse({ error: "That photo is too large — try a smaller image." }, 413);
  }

  const ext = storagePath.split(".").pop()?.toLowerCase() ?? "";
  const mediaType = MEDIA_TYPE_BY_EXT[ext];
  if (!mediaType) {
    return jsonResponse({ error: "Unsupported image type — use JPEG, PNG, WebP, or GIF." }, 400);
  }

  const imageBytes = new Uint8Array(await imageBlob.arrayBuffer());
  const imageB64 = btoa(String.fromCharCode(...imageBytes));

  // Full catalog vocabulary, not pre-filtered by meal slot (decided
  // 2026-09-15 — simpler than a filtering strategy, at higher per-request
  // token cost; revisit if that cost turns out to matter in practice).
  const { data: dishRows, error: dishesError } = await supabase
    .from("dishes")
    .select("id, name, serving_size, calories, protein_g, carbs_g, fat_g, fiber_g")
    .eq("is_active", true);
  if (dishesError || !dishRows) {
    return jsonResponse({ error: "Failed to load the dish catalog." }, 500);
  }
  const dishes = dishRows as DishVocabEntry[];
  const dishById = new Map(dishes.map((d) => [d.id, d]));

  const prompt = buildMealPhotoPrompt(dishes);

  let anthropicRes: Response;
  try {
    anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: prompt,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: imageB64 } },
              { type: "text", text: "Analyze this meal photo and return the JSON as instructed." },
            ],
          },
        ],
      }),
    });
  } catch {
    return jsonResponse({ error: "Couldn't reach the photo analysis service. Try again." }, 502);
  }

  if (!anthropicRes.ok) {
    return jsonResponse({ error: mapAnthropicError(anthropicRes.status) }, 502);
  }

  const anthropicBody = await anthropicRes.json();
  const rawText: string | undefined = anthropicBody?.content?.[0]?.text;
  if (!rawText) {
    return jsonResponse({ error: "No result came back — try again with a clearer photo." }, 502);
  }

  let modelResult: ModelResponse;
  try {
    modelResult = JSON.parse(rawText);
  } catch {
    return jsonResponse({ error: "The analysis result didn't parse cleanly — try again." }, 502);
  }

  const items = (modelResult.items ?? [])
    .map((raw) => sanitizeModelItem(raw, dishById))
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const computedItems = items.map((item) => ({
    ...item,
    computed_macros: computeItemMacros(item, dishById),
  }));
  const totals = sumMacros(computedItems.map((i) => i.computed_macros));

  // Log every unmatched item now, regardless of whether the user goes on to
  // confirm this meal log — the model having seen something it couldn't
  // match is useful admin signal on its own (PRD 6.7 review queue).
  const unmatched = items.filter((i) => i.matched_dish_id === null);
  if (unmatched.length > 0) {
    await supabase.from("unmatched_food_events").insert(
      unmatched.map((i) => ({
        user_id: user.id,
        seen_as: i.seen_as,
        estimate: i.unmatched_estimate,
      }))
    );
    // Best-effort: a logging failure here shouldn't fail the whole analysis
    // response the user is waiting on.
  }

  return jsonResponse(
    {
      items: computedItems,
      totals,
      overall_confidence: modelResult.overall_confidence ?? "medium",
      notes: modelResult.notes ?? "",
    },
    200
  );
});
