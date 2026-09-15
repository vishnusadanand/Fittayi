"""
Fittayi — Photo-to-Calorie Prototype
=====================================

Purpose: validate whether a multimodal AI vision model can reliably MATCH food
items in a photo to Fittayi's own dish database and estimate a portion-size
MULTIPLIER, before building the full photo-logging feature into the app.

IMPORTANT — architecture, decided (see FITTAYI_PRD.md Section 6.5): Claude
does NOT calculate calories itself. It only (a) matches each visible item to
a dish id from the reference table below, or leaves it unmatched, and (b)
estimates how the visible portion compares to that dish's standard serving.
This script then computes the final calories/macros deterministically
(`stored value × multiplier`) — the same math the real Edge Function must do
server-side. This keeps every estimate of the same dish consistent and
auditable, instead of Claude inventing a fresh absolute number each time.

This is the same PROMPT/schema as `plate-check.html` in this folder, just
calling the real Anthropic API directly instead of Claude's artifact
`sample()` capability — this file is what the Edge Function's prompt-building
and response-handling logic should actually be modeled on. The reference
table below (15 dishes, same ids as `plate-check.html`'s DISH_DB) is a
stand-in for a live query against the real `dishes` table — in the Edge
Function, DISH_DB must be built from that table at request time, not
hardcoded, and `matched_dish_id` becomes a real dish UUID rather than a slug.

Run this against 15-20 real photos of actual meals people will log (Kerala
home-cooked food, restaurant plates, packaged snacks, varying lighting/
angles) and manually check the numbers against known values where you can
(e.g. a dish you cooked and know the ingredients/portions for).

What "good enough" looks like before building further:
  - Dish matching is right most of the time (it will sometimes miss/confuse
    visually similar dishes — e.g. two similar-looking curries — or correctly
    decline to match something not in the table).
  - Portion multipliers are in the right ballpark (+/- 20-30%) for common
    portion sizes, not that they're precise. Photos alone can't reliably
    capture depth/volume, so treat this as "informed estimate", not a lab
    measurement, and say so in the app UI.
  - Confidence flags actually correlate with when the model is guessing (e.g.
    unusual angle, food mostly hidden, unfamiliar dish).

If matching accuracy is too poor for your use case, the fallback (discussed
with ViSa) is to lean more heavily on the unmatched-item review-queue path
(Section 6.7) and grow the dish database faster from real logged photos,
rather than trusting a larger first-principles estimate from the model.

Setup:
    pip install anthropic
    export ANTHROPIC_API_KEY=sk-ant-...

Usage:
    python food_calorie_estimator.py path/to/meal_photo.jpg
"""

import base64
import json
import sys
from pathlib import Path

import anthropic

MODEL = "claude-sonnet-4-5-20250929"  # swap to whichever Claude model your account has access to

# Stand-in for a live query against Fittayi's real `dishes` Postgres table.
# Same 15 dishes / same ids as plate-check.html's DISH_DB, so both prototypes
# stay directly comparable. In the real Edge Function this list — and the
# vocabulary lines built from it below — must come from the database, not be
# hardcoded, so it never drifts out of sync with the real catalog.
DISH_DB = [
    {"id": "idli", "name": "Idli", "unit": "1 medium (~40g)", "cal": 58, "protein": 2, "carbs": 12, "fat": 0.1, "fiber": 0.5},
    {"id": "dosa_plain", "name": "Plain dosa", "unit": "1 medium", "cal": 133, "protein": 2.7, "carbs": 18, "fat": 5, "fiber": 1},
    {"id": "dosa_masala", "name": "Masala dosa", "unit": "1, with potato filling", "cal": 250, "protein": 5, "carbs": 35, "fat": 10, "fiber": 3},
    {"id": "sambar", "name": "Sambar", "unit": "1 cup (240ml)", "cal": 150, "protein": 7, "carbs": 22, "fat": 4, "fiber": 5},
    {"id": "rasam", "name": "Rasam", "unit": "1 cup (240ml)", "cal": 60, "protein": 2, "carbs": 10, "fat": 1.5, "fiber": 1},
    {"id": "coconut_chutney", "name": "Coconut chutney", "unit": "2 tbsp (30g)", "cal": 70, "protein": 1, "carbs": 3, "fat": 6, "fiber": 2},
    {"id": "rice", "name": "Steamed rice", "unit": "1 cup cooked (150g)", "cal": 200, "protein": 4, "carbs": 45, "fat": 0.4, "fiber": 0.6},
    {"id": "fish_curry", "name": "Kerala fish curry", "unit": "1 serving (~150g)", "cal": 220, "protein": 20, "carbs": 6, "fat": 13, "fiber": 1},
    {"id": "chicken_curry", "name": "Chicken curry", "unit": "1 serving (~150g)", "cal": 260, "protein": 22, "carbs": 7, "fat": 16, "fiber": 1},
    {"id": "beef_curry", "name": "Kerala beef curry", "unit": "1 serving (~150g)", "cal": 280, "protein": 24, "carbs": 6, "fat": 18, "fiber": 1},
    {"id": "thoran", "name": "Thoran", "unit": "1/2 cup (75g)", "cal": 90, "protein": 2, "carbs": 8, "fat": 6, "fiber": 3},
    {"id": "avial", "name": "Avial", "unit": "1/2 cup (100g)", "cal": 120, "protein": 3, "carbs": 12, "fat": 7, "fiber": 3},
    {"id": "appam", "name": "Appam", "unit": "1 piece", "cal": 120, "protein": 2, "carbs": 22, "fat": 3, "fiber": 0.5},
    {"id": "puttu", "name": "Puttu", "unit": "1 cylinder (100g)", "cal": 170, "protein": 3, "carbs": 36, "fat": 1, "fiber": 2},
    {"id": "parotta", "name": "Parotta", "unit": "1 piece (60g)", "cal": 260, "protein": 5, "carbs": 35, "fat": 11, "fiber": 1.5},
]
DISH_BY_ID = {d["id"]: d for d in DISH_DB}

_vocab_lines = "\n".join(f'- id "{d["id"]}": {d["name"]}, standard serving = {d["unit"]}' for d in DISH_DB)

SYSTEM_PROMPT = (
    "You are a nutrition-logging assistant inside a fitness app with a Kerala-first Indian user base. "
    "Do NOT calculate calories yourself for known dishes — your job is to identify each food item and judge its "
    "portion size, so the app can look up real numbers from its own dish database.\n\n"
    "DISH DATABASE (match against these first):\n" + _vocab_lines + "\n\n"
    "You are shown one photo of a meal. For each distinct food item visible:\n"
    "1. Try to match it to one dish id above. Use matched_dish_id for that id, or null if nothing above genuinely fits "
    "(don't force a bad match — a wrong match is worse than \"no match\").\n"
    "2. If matched, estimate portion_multiplier: how the visible amount compares to that dish's standard serving "
    "(1.0 = standard serving, 0.5 = half, 2 = double). Look for a real-world size reference in the photo (a steel "
    "plate ~26-28cm, a katori/bowl ~150-300ml, a spoon, a hand, a banana leaf) and name it in reference_used.\n"
    "3. If NOT matched, leave portion_multiplier null and instead fill unmatched_estimate with your own "
    "first-principles calorie/macro guess for the amount visible (this is a rough fallback, not a database lookup).\n"
    "4. Give seen_as: a short human description of what you saw (e.g. \"3 medium idlis\", \"small bowl of green chutney powder\").\n"
    "5. Rate confidence high/medium/low per item — be honest: low when the photo is unclear, portion is hard to judge, "
    "items are stacked/mixed, or a condiment bowl's eaten amount is unpredictable.\n"
    "6. Never refuse to estimate.\n\n"
    "Reply with ONLY a JSON object, no markdown fences, no text outside the JSON, matching exactly:\n"
    "{\n"
    '  "items": [\n'
    '    {"matched_dish_id": string|null, "seen_as": string, "portion_multiplier": number|null, '
    '"reference_used": string, "confidence": "high"|"medium"|"low", '
    '"unmatched_estimate": {"calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "fiber_g": number}|null}\n'
    "  ],\n"
    '  "overall_confidence": "high"|"medium"|"low",\n'
    '  "notes": string\n'
    "}"
)


def encode_image(path: Path) -> tuple[str, str]:
    media_type = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }.get(path.suffix.lower())
    if not media_type:
        raise ValueError(f"Unsupported image type: {path.suffix}")
    data = base64.standard_b64encode(path.read_bytes()).decode("utf-8")
    return data, media_type


def compute_item_macros(item: dict) -> dict:
    """Deterministic math — this is the part that never asks Claude. Mirrors
    plate-check.html's computeItemMacros() exactly, so both prototypes agree."""
    matched_id = item.get("matched_dish_id")
    if matched_id and matched_id in DISH_BY_ID:
        d = DISH_BY_ID[matched_id]
        m = item.get("portion_multiplier") or 1
        return {
            "calories": d["cal"] * m,
            "protein_g": d["protein"] * m,
            "carbs_g": d["carbs"] * m,
            "fat_g": d["fat"] * m,
            "fiber_g": d["fiber"] * m,
        }
    est = item.get("unmatched_estimate")
    return est if est else {"calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fiber_g": 0}


def call_model(image_path: str) -> dict:
    path = Path(image_path)
    image_b64, media_type = encode_image(path)

    client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env

    response = client.messages.create(
        model=MODEL,
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": "Analyze this meal photo and return the JSON as instructed.",
                    },
                ],
            }
        ],
    )

    raw_text = response.content[0].text.strip()
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        print("--- Model did not return clean JSON, raw output below ---")
        print(raw_text)
        raise


def estimate_meal(image_path: str) -> dict:
    """Calls the model for matches/portions, then computes final macros
    deterministically — same two-step split the Edge Function must do."""
    model_result = call_model(image_path)
    items = model_result.get("items", [])

    totals = {"calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fiber_g": 0}
    computed_items = []
    for item in items:
        macros = compute_item_macros(item)
        for k in totals:
            totals[k] += macros[k]
        computed_items.append({**item, "computed_macros": macros})

    return {
        "items": computed_items,
        "totals": totals,
        "overall_confidence": model_result.get("overall_confidence", "medium"),
        "notes": model_result.get("notes", ""),
    }


def main():
    if len(sys.argv) != 2:
        print("Usage: python food_calorie_estimator.py path/to/meal_photo.jpg")
        sys.exit(1)

    result = estimate_meal(sys.argv[1])
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
