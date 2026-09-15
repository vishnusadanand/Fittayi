# Fittayi — Photo Logging, Admin Portal & Workout Circuit
### Handoff notes — 2026-09-15 (corrected 2026-09-15, post-review)

This folder has everything confirmed today, ready to hand to Antigravity against your real Supabase/Cloudflare/GitHub codebase. The four prototype files in here are **working, self-contained HTML demos** — they don't run against your real database, but the JavaScript inside them (the prompts, data structures, matching logic, and UI flow) is meant to be read and adapted directly, not just used as a mockup to eyeball.

**Important:** these prototypes ran on Claude's own artifact platform (a `sample()` call that asks Claude directly, and a small per-artifact database) — neither of those exists in a normal web app. In your real app, every place these prototypes call `sample()` or `db.*` needs to become a call to your own Supabase Edge Function / Postgres table instead. That's called out below, file by file.

**Authoritative spec:** `FITTAYI_PRD.md` v1.1, Sections 6.5 (Photo-Based Meal Logging), 6.6 (Workout Module), 6.7 (Admin Portal), and Section 9's scope list — these were missing from the PRD body as of the first version of this handoff (the changelog referenced them, but the section text itself hadn't been written yet) and have since been filled in. Read those sections in full before this README; this file is implementation notes on top of that spec, not a replacement for it.

**A note on this revision:** a review pass on 2026-09-15 found the first version of this handoff had a few real inconsistencies between its own documents — most importantly, `food_calorie_estimator.py` implemented a *different, previously-rejected* architecture than `plate-check.html` despite being described as "closer to what your Edge Function should do." That's fixed now (see Section 1). Everything below reflects the corrected state.

---

## Cross-cutting: platform-specific code that won't port literally

All three interactive prototypes (`plate-check.html`, `fittayi-admin.html`, `daily-circuit.html`) have error-handling and data-access code tied to Claude's artifact sandbox, not a real backend. This applies throughout, not just in the sections below:

- **Error codes.** `plate-check.html`'s `sample()` catch block matches codes like `not_granted`, `image_rejected`, `sampling_disabled`. `fittayi-admin.html`'s `handleWriteError` checks `e.code === 'invalid_argument'` for a denied write. None of these will ever match a real Anthropic SDK error or a real Supabase/PostgREST error (an RLS-denied write surfaces as a 401/403 or a Postgres error code like `42501`, not `invalid_argument`). Port the *pattern* (show a specific, honest message per failure mode) but remap every code to what the real SDK/client actually returns — otherwise every real error silently falls through to the generic catch-all and none of the specific copy ever fires.
- **Data layer.** `fittayi-admin.html`'s `db.collection(...).doc(...).onSnapshot(...)` is Firestore-shaped. The live-sync pattern (`subscribeAll` → `recomputeAll` on every snapshot) needs to become either Supabase Realtime channels or a refetch-after-mutation pattern against `supabase.from(...)` — a structural decision, not a find-and-replace.

---

## 1. Photo → calorie logging (`plate-check.html` + `food_calorie_estimator.py`)

**Decided approach (PRD 6.5):** Claude does NOT calculate calories. It only (a) matches each food item in a photo against your own dish vocabulary, and (b) estimates a portion-size multiplier relative to that dish's standard serving. Your backend then computes calories deterministically — real number × multiplier — so results are consistent and auditable instead of a fresh AI guess every time. Unmatched items fall back to a rough one-off AI estimate and get logged for review (see the admin portal), not treated as authoritative.

**What to port:**
- The `PROMPT` string in `plate-check.html` (built from `DISH_DB`) — the actual prompt template to send to Claude's vision API from a Supabase Edge Function. It asks for JSON matching `{items: [{matched_dish_id, seen_as, portion_multiplier, reference_used, confidence, unmatched_estimate}], overall_confidence, notes}`.
- The reference dish list (`DISH_DB`, ~15 common Kerala/South Indian dishes with standard servings and macros) — this is a stand-in for your real `dishes` table. Generate the prompt's vocabulary list from that table live at request time (not hardcoded) so it's always in sync. **Open question (PRD §12):** the real catalog is 210+ dishes, not 15 — decide whether every request sends the full catalog as context or pre-filters first (e.g. by meal type), before finalizing the Edge Function's prompt-construction logic. This affects both per-request cost and match accuracy.
- The confirmation UI logic (`computeItemMacros`, `renderItems`, the portion slider) — the pattern for the screen where a user corrects a dish match or portion before it's logged. Deterministic math happens client-side from data your API returns; nothing needs to be recalculated by AI on a correction.
- `food_calorie_estimator.py` — a standalone reference implementation of **the same** `matched_dish_id`/`portion_multiplier` prompt and schema as `plate-check.html`, calling the real Anthropic API directly instead of Claude's artifact `sample()`. This is what your Edge Function's prompt-building and response-handling should actually be modeled on — it now includes the deterministic `compute_item_macros()` step too, so running it end-to-end demonstrates the full match → multiply → total flow, not just the raw model call. Needs `pip install anthropic` and an `ANTHROPIC_API_KEY`.

**Backend pieces still needed:** an Edge Function that accepts an uploaded photo (from Supabase Storage), builds the prompt from your live `dishes` table, calls the Anthropic API, computes final macros server-side, and returns items for the client to confirm; a `meal_logs` table to save confirmed entries; logging every unmatched item to `unmatched_food_events` (see Section 2 — this is a log table, not a counter).

---

## 2. Admin portal (`fittayi-admin.html`)

Four sections: Dashboard, Users, Dish database, Review queue (PRD 6.7). In the prototype these run on a Claude-only database (`claude.use('db')`) seeded with example data — replace every `db.collection(...)`/`db.doc(...)` call with real Supabase queries (see the cross-cutting note above on what that actually involves).

**Schema (Postgres) — decided, not "or":**
- `dishes`: extend the existing table with `aliases` (`text[]`, for catching "green chutney" vs "coriander chutney" synonym gaps before treating something as genuinely new).
- `unmatched_food_events`: one row per unmatched item seen (user_id, seen_as, estimate jsonb, created_at). **Not** a `review_queue` table with a mutable `times_flagged` counter — that has a race condition under concurrent uploads. The admin UI's "Flagged N×" display and sort-by-flag-count (`queueItemEl`, `renderQueue` in the prototype) should be driven by a `GROUP BY seen_as` aggregate query over this log table instead of a stored field. The prototype's UI logic (sort by a flag count, render a list) still applies — only the query backing the number changes.
- `user_profiles` (**not** `profiles` — that's the existing table's real name): extend with `body_fat_pct` and the new `conditions` field (`text[]`, see Section 3 — it's multi-select, not a single value). `height_cm`, `weight_kg`, `goal`, `diet_type` already exist.
- An `is_admin` boolean or role column on `user_profiles`, enforced with Postgres RLS policies so only admins can read/write `dishes` and `unmatched_food_events` — the prototype's own access gating (Claude sharing permissions) doesn't apply to your real app at all; this is the part that actually needs to exist for real security. The prototype's "attempt the write, handle the rejection" pattern (`canWrite`, `handleWriteError`) is a reasonable UX to keep — RLS rejections genuinely do surface this way — just remap the error code per the cross-cutting note above.
- **Users tab must use real enum values, not display strings.** The prototype's `SEED_USERS`/goal picker use labels like "Fat loss" / "Muscle gain" / "Non-vegetarian" and only offer 3 goal options. The real `user_profiles.goal` CHECK constraint has 5 values (`cut`, `cut_aggressive`, `maintain`, `build`, `recomp`) and `diet_type` uses `veg`/`vegan`/`egg`/`non_veg`. Build an enum↔label mapping layer for this tab rather than porting the prototype's dropdown options as-is.

**"Add to database" flow** (in the Review queue tab) is the actual mechanism that should grow your dish table over time — port this exact interaction: pick the highest-flagged unmatched item (from the aggregate query above), pre-fill a dish form with its rough estimate, let an admin correct the numbers, save it, and mark the underlying events resolved.

---

## 3. Workout circuit (`daily-circuit.html`)

**Decided scope (PRD 6.6):** bodyweight-only exercises, one routine per goal (fat loss / muscle gain / maintain weight) to start, 2D animated stick-figure demos instead of 3D (3D deferred — real production cost, not needed to validate the feature), tracking via a daily reminder email to anyone who hasn't completed that day's circuit — **no in-app streak UI in v1.** The prototype's earlier version had a visible streak counter woven into `finishSession()`; that's been removed (see below) so the reference implementation matches the actual decision.

**New onboarding question to add:** "Any injuries or conditions we should know about?" — **multi-select** (a user can have more than one), options Knee / Back / Wrist-shoulder / None. Store as `user_profiles.conditions` (`text[]`), not a single value — the prototype's `renderConditionRow`/`state.conditions` already implements this as a checkbox multi-select; the shorthand phrasing elsewhere undersold that it's multi-select.

**What to port:**
- `EX` and `ALT` objects — the exercise library (name, animation category, reps-vs-time, target, and which injury tags each move should be swapped out for). `ROUTINES` maps each goal to an ordered exercise list.
- The substitution logic (`buildRoutine()`) — matches a user's stated conditions against each exercise's tags and swaps in the safer alternative, with the swap shown transparently in the UI. Note the `wrist`/`shoulder` tags are currently coupled (every exercise tagged `shoulder` is also tagged `wrist`, and the condition checkbox only ever emits `wrist`) — fine today, but if you add an exercise tagged `shoulder` alone later, it won't get caught unless the condition selector is updated too.
- The CSS animation system (`ANIM_CSS`) — nine reusable motion presets applied to one SVG stick-figure. Portable to React/whatever your frontend uses; it's plain CSS keyframes on transform. Now includes a `prefers-reduced-motion` guard (freezes the figure at rest pose rather than hiding it, per PRD §8.3) — keep this when porting.
- The session/timer state machine (`beginSession`, `tick`, `advance`, `finishSession`) — countdown for timed moves, rep target + "Done" for rep-based ones, a rest phase between each, and a completion step. `finishSession` now calls `markCompleted()` purely to persist completion for the reminder job — it no longer computes or displays a streak.

**Backend pieces still needed:** a `workout_completions` table (`user_id`, `date`) — the prototype fakes this with Claude's artifact database (`progress/completion`, tracking only `lastCompletedDate`, deliberately no streak count). Your Edge Function/cron job that sends the daily reminder email should query this table for anyone without today's date logged. `pg_cron` + a Supabase Edge Function hitting your email provider is the natural mechanism on your stack. **Open question (PRD §12):** what timezone defines "today" for both this table and the cron job — working assumption is IST given Kerala-first launch, not yet explicitly confirmed.

---

## Suggested order for Antigravity

1. Migrations: `dishes.aliases`, `unmatched_food_events`, `meal_logs`, `workout_completions`, and the `user_profiles` column additions (`body_fat_pct`, `conditions text[]`, `is_admin`).
2. Seed/verify `dishes` against the reference list in `plate-check.html` / `food_calorie_estimator.py` (already present in the real catalog — confirm no gaps).
3. Photo-analysis Edge Function (dish-matching prompt + deterministic calorie math, modeled on `food_calorie_estimator.py`) — highest-risk piece, build and test first, same as we did here.
4. Confirmation screen UI in your real frontend, adapted from `plate-check.html`'s item-editing logic.
5. Admin routes (reuse your existing auth — gate by the `is_admin` role via RLS, not just a frontend check).
6. Workout circuit screen + exercise data, adapted from `daily-circuit.html`.
7. Daily reminder email job.

---

## One thing I need from you

You mentioned wanting this "taken by the supervised model" in Antigravity — I wasn't sure exactly what that refers to (an autonomy/review setting in Antigravity itself?), so I didn't want to guess and give you the wrong instructions for it. Let me know what you mean and I can be more specific about that step.
