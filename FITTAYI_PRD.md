# FITTAYI — Product Requirements Document

**Version:** 1.1
**Owner:** ViSa
**Status:** Draft for build handoff (Google Antigravity)

**Changelog:** v1.1 (2026-09-15) — added Photo-Based Meal Logging, Workout/Exercise Module, and Admin Portal to scope (Sections 6.5–6.7); updated Section 9 scope list and Non-Goals accordingly. Reference implementations and architecture notes for all three: `/fittayi-handoff-2026-09-15/` in this repo.

---

## 1. Product Summary

FITTAYI is a web app that generates personalized, calorie- and macro-based meal plans built from real Indian dishes, for people pursuing a fitness or body-composition goal (fat loss, maintenance, muscle gain, recomposition). It differentiates from generic calorie-counting apps by using an Indian-kitchen-native dish database instead of Western meal templates, and by enforcing safe, evidence-based calorie floors rather than letting users select unsafely aggressive deficits.

## 2. Problem Statement

Existing meal-planning tools either:
- Default to Western food templates that don't map to how Indian users actually eat, or
- Let users self-select aggressive calorie deficits with no safety guardrails, or
- Provide no regional/dish-level granularity (generic "500 kcal lunch" with no actual dish suggestion).

FITTAYI solves this by combining a structured Indian dish database with a deterministic, safety-floored calorie/macro engine.

## 3. Goals

| Goal | Metric |
|---|---|
| Generate a safe, personalized meal plan in under 2 minutes | Quiz-to-plan completion time |
| Keep users returning weekly | Day-7 and Day-30 return rate |
| Avoid prescribing unsafe calorie targets | 0% of generated plans below hard safety floor |
| Build trust through real (not placeholder) data | Real testimonials/stats only, added post-launch |

## 4. Target Users

- Primary: **Kerala-first launch.** Users in Kerala who exercise regularly and want a structured, food-realistic meal plan — not bodybuilders needing competition-prep precision, not people with diagnosed eating disorders or clinical nutrition needs (see Non-Goals). Dish database and cuisine_region tagging should prioritize Kerala/South Indian dishes at launch, with pan-India expansion planned for a later phase once the model is validated.
- Secondary (post-launch expansion): broader pan-India users, then Indian diaspora.

## 5. Core User Flow

1. **Landing page** → user starts a quiz (no signup required to see a sample plan).
2. **Quiz** (~10 questions): sex, age, height, weight, activity level, goal (cut/maintain/build/recomp), dietary restrictions (veg/vegan/egg/non-veg, allergens), cuisine region preference.
3. **Plan generation**: system computes BMR → TDEE → goal-adjusted calorie target (with safety floor check) → macro split → per-meal targets → dish selection.
4. **Sample plan shown** (one day free, no signup).
5. **Signup gate**: to save/get the full week and track progress, user creates an account.
6. **Dashboard**: weekly plan view, swap-a-dish, daily check-in (adherence, optional weight log), regenerate plan.

## 6. Functional Requirements

### 6.1 Calorie & Macro Engine (deterministic, not LLM-based)
- BMR via Mifflin-St Jeor equation.
- TDEE via activity multiplier (sedentary 1.2 → very active 1.9).
- Goal adjustment: cut −20%, cut_aggressive −25% (hard ceiling), maintain 0%, build +10%, recomp −5%.
- **Hard safety floors, always enforced regardless of goal selected:**
  - Never below 1500 kcal (male) / 1200 kcal (female).
  - Never below 90% of BMR.
  - If the user's selected goal would fall below the floor, the system must **clamp to the floor and explicitly tell the user why** (not silently override).
- Macro split: protein by bodyweight (1.6–2.2 g/kg depending on goal), fat floored at 25% of calories, carbs fill remainder. If protein+fat alone exceed the calorie target, scale protein down rather than allowing negative carbs.
- Meal distribution: default 25% breakfast / 35% lunch / 30% dinner / 10% snacks; must be stored as a configurable table, not hardcoded, to support future customization (e.g., intermittent fasting).
- This logic lives server-side (Edge Function), never trusted from client input, so it can't be tampered with and stays auditable.

### 6.2 Dish Database & Selection
- Dishes stored with: name, meal_type(s), cuisine_region, diet_type, calories, protein/carbs/fat/fiber, serving size, allergens, data source.
- Launch target: 150–200 dishes minimum (v1 MVP can launch with fewer — see Section 9 — but must not launch below ~60 to avoid immediate repetition complaints).
- Calorie/macro values should be validated against IFCT (Indian Food Composition Tables) where possible; every dish record stores its data source for auditability.
- Selection algorithm: for each meal slot, filter candidate dishes by diet type, allergen exclusions, and calorie tolerance band (±10%), exclude dishes served to this user in the last 3 days, then rank by closeness to the protein target.

### 6.3 User Accounts & Persistence
- Auth: email + Google login.
- Saved weekly plans, dish swap history, adherence check-ins.
- Row-level security: users can only ever read/write their own plan and history data.

### 6.4 Trust & Legal
- Privacy policy and terms of service required before any signup collecting health data (DPDP Act, India, applies).
- Visible disclaimer: "Not a substitute for professional medical or dietetic advice."
- No fabricated stats or testimonials — display real numbers once available, or omit the section entirely pre-launch.

### 6.5 Photo-Based Meal Logging
- **Claude does not compute calories from a photo.** Given an uploaded meal photo, the model's only job is to (a) match each visible food item against FITTAYI's own `dishes` table and (b) estimate a portion-size multiplier relative to that dish's standard serving (reasoning from a visible size reference — plate, katori/bowl, spoon, hand, banana leaf). The app then computes final calories/macros deterministically (`stored dish value × multiplier`) server-side, so results are consistent and auditable rather than a fresh AI guess every time a user logs the same dish.
- The vision prompt's dish vocabulary is generated live from the `dishes` table at request time, not hardcoded, so it never drifts out of sync with the real catalog.
- If no dish genuinely matches, the item is not forced into a bad match. It gets a rough one-off first-principles estimate instead, and is logged for admin review (Section 6.7) rather than treated as an authoritative log entry.
- This is a separate concern from the calorie/macro *target*-setting engine in Section 6.1 (`calorieEngine.ts`) — that engine computes what a user *should* eat from BMR/TDEE; photo logging estimates what they *did* eat from a photo. They must not be merged, but both read from the same `dishes` table so a dish's numbers are defined in exactly one place.
- Schema additions: `dishes.aliases` (`text[]`, catches synonym gaps — e.g. "green chutney" vs "coriander chutney" — before something is wrongly treated as a new dish), a `meal_logs` table for confirmed entries, and an `unmatched_food_events` log table (one row per unmatched item seen, not a mutable counter — admin-side "times flagged" is a `GROUP BY seen_as` aggregate over this log, avoiding counter race conditions under concurrent uploads).
- Backend: a Supabase Edge Function accepts an uploaded photo (Supabase Storage), builds the prompt from the live `dishes` table, calls the Anthropic API, computes final macros server-side, and returns items for the client to confirm/correct before logging.

### 6.6 Workout Module
- Bodyweight-only exercises. One routine per goal (fat loss / muscle gain / maintain weight) for v1. 2D CSS/SVG stick-figure animation, not 3D (deferred — production cost not justified to validate the feature).
- New onboarding question: injury/condition, **multi-select** (a user may have more than one) — options: knee, back, wrist/shoulder, none. Stored on `user_profiles` as `text[]`. Used to substitute individual exercises for safer alternatives; any swap is shown transparently to the user in the session UI, never silent.
- Tracking for v1 is via a **daily reminder email** (cron-driven) to anyone who hasn't completed that day's circuit — **not** an in-app streak counter or streak UI. The app still records completion (date + user) so the cron job has something to query against, but that data is not surfaced back to the user as a streak in v1.
- Schema addition: `workout_completions` (user_id, date, and whatever the reminder job needs to query "who's missing today").
- Backend: `pg_cron` + a Supabase Edge Function that queries `workout_completions` for the day and sends the reminder via the chosen email provider (open question — see Section 12).

### 6.7 Admin Portal
- Four sections: Dashboard (KPIs), Users, Dish database, Review queue.
- Gated server-side via Postgres RLS on an `is_admin`/role column on `user_profiles` — never a frontend-only check. The UI may optimistically attempt a write and handle an RLS rejection in the response (simpler than a separate pre-check), but the enforcement itself must live in the database policy.
- Dish database tab: standard CRUD against `dishes`, including the new `aliases` column.
- Review queue tab: unmatched photo-logging items (Section 6.5), ranked by how often each has been seen (aggregated from `unmatched_food_events`). Core workflow: pick the highest-flagged item, pre-fill a dish form with its rough estimate, let an admin correct the numbers, save it to `dishes`, mark the underlying events resolved. This is the intended mechanism for growing the dish catalog over time from real user photos, not just the manual seeding process in Section 6.2.
- Users tab: view/edit a user's profile fields (`user_profiles` — height, weight, body_fat_pct, goal, diet_type, injury conditions). Goal and diet_type must reflect the real enums (`cut`/`cut_aggressive`/`maintain`/`build`/`recomp` and `veg`/`vegan`/`egg`/`non_veg`), not display-only labels.

## 7. Non-Functional Requirements

- Mobile-responsive (majority of Indian web traffic is mobile-first).
- Page load under 2s for the quiz and landing page.
- All health-adjacent data (weight, dietary restrictions) encrypted at rest and never exposed via client-side keys.
- Calorie engine must be unit-testable independent of the UI.

## 8. Technical Direction

- **Frontend**: React (Vite), mobile-first responsive design.
- **Backend**: Supabase (Postgres, Auth, Storage, Edge Functions) — can be provisioned as Lovable Cloud or a standalone Supabase project; schema below is backend-agnostic.
- **Calorie/macro engine**: deterministic TypeScript module, deployed as a Supabase Edge Function (Deno runtime). Reference implementation already written (`calorieEngine.ts`) — includes BMR/TDEE/goal-adjustment/macro/meal-distribution functions with floor-clamping and an explicit `wasFloorClamped` flag for UI transparency.
- **Where LLM/AI is appropriate**: recipe instructions, conversational dish swaps ("swap this for something without dairy"), "what's in my kitchen" flexibility. **Not appropriate for**: core calorie/macro math, which must remain deterministic and auditable.

### 8.1 Database Schema (core tables)

```sql
-- Dish catalog
create table dishes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_local text,
  meal_type text[] not null,          -- breakfast, lunch, dinner, snack
  cuisine_region text,
  diet_type text not null,            -- veg, vegan, egg, non_veg
  calories numeric(6,1) not null,
  protein_g numeric(5,1) not null,
  carbs_g numeric(5,1) not null,
  fat_g numeric(5,1) not null,
  fiber_g numeric(5,1),
  serving_size text,
  serving_weight_g numeric(6,1),
  prep_time_minutes int,
  allergens text[],
  restrictions_ok text[],             -- e.g. diabetic_friendly, low_gi
  data_source text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table dish_ingredients (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid references dishes(id) on delete cascade,
  ingredient_name text not null,
  quantity text,
  is_optional boolean default false
);

-- Generated plans (RLS: user can only access own rows)
create table user_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  plan_date date not null,
  meal_slot text not null,
  dish_id uuid references dishes(id),
  target_calories numeric,
  actual_calories numeric,            -- snapshot at generation time
  created_at timestamptz default now()
);

create table user_dish_history (
  user_id uuid references auth.users(id),
  dish_id uuid references dishes(id),
  served_on date not null,
  primary key (user_id, dish_id, served_on)
);

create index idx_dishes_meal_type on dishes using gin (meal_type);
create index idx_dishes_diet_type on dishes (diet_type);
create index idx_dishes_calories on dishes (calories);
create index idx_dishes_allergens on dishes using gin (allergens);
```

### 8.2 Calorie Engine — Key Logic Summary

```
BMR (male)   = 10×weight_kg + 6.25×height_cm − 5×age + 5
BMR (female) = 10×weight_kg + 6.25×height_cm − 5×age − 161
TDEE = BMR × activity_multiplier
raw_target = TDEE × (1 + goal_adjustment_pct)
final_target = MAX(raw_target, safe_floor_by_sex, BMR × 0.9)
  → if clamped, surface reason to user in UI

protein_g = weight_kg × protein_g_per_kg[goal]
fat_kcal = final_target × 0.25
carbs_kcal = final_target − protein_kcal − fat_kcal  (floor at 0, rebalance protein if needed)
```

Full reference implementation: see `calorieEngine.ts` (provided separately).

### 8.3 Dark Theme Design System

FITTAYI's UI runs on a dark theme by default. The palette is built around Kerala's spice-market and backwater visual world rather than a generic near-black + neon-accent look — food and energy should feel warm, not clinical.

**Color tokens:**

| Token | Hex | Usage |
|---|---|---|
| `--bg-base` | `#12181A` | App background — deep charcoal with a slight green undertone (backwater black) |
| `--bg-surface` | `#1B2422` | Cards, quiz panels, dashboard tiles |
| `--bg-surface-raised` | `#232E2B` | Modals, hover states, elevated elements |
| `--accent-primary` | `#E8A33D` | Turmeric gold — primary CTAs, active states, protein/energy highlights |
| `--accent-secondary` | `#4F7869` | Cardamom green — success states, "on track" indicators, secondary actions |
| `--accent-warning` | `#D96E4C` | Terracotta — floor-clamp warnings, allergen flags, destructive actions |
| `--text-primary` | `#F2EFE9` | Body copy, headings — warm off-white, not pure white |
| `--text-secondary` | `#9CA8A4` | Captions, meta text, muted sage-grey |
| `--border-subtle` | `#2A3532` | Card borders, dividers |

**Typography:** a warm, slightly characterful display face for headings (evoking hand-painted spice-market signage — not a default geometric sans), paired with a clean humanist body face optimized for reading numbers (calories, macros) at a glance. A monospace/tabular-number utility face for the calorie/macro figures themselves keeps stat displays aligned and scannable.

**Design requirements:**
- All text/background combinations must meet WCAG AA contrast minimums (4.5:1 for body text, 3:1 for large text) — verify `--text-secondary` against `--bg-surface` specifically, as muted-on-dark combinations are the most common contrast failure.
- Macro/calorie numbers (the core content of the product) should visually lead each card — treat them with the same hierarchy discipline as a headline, not as fine print.
- The floor-clamp warning state (Section 6.1) uses `--accent-warning` and must remain visually distinct from a normal informational state — this is a safety-relevant UI moment, not a cosmetic one.
- Respect `prefers-reduced-motion`; keep any transitions purposeful (state changes, not ambient decoration).
- Maintain visible keyboard focus states in the dark theme — a common miss is focus rings that are too low-contrast against dark surfaces.
- Mobile-first: verify the palette and type scale hold up at small sizes, since Section 7 notes mobile is the majority-traffic case.


## 9. Scope (MVP v1.1)

**In scope:**
- Quiz → calorie/macro engine → sample one-day plan (no signup)
- Signup/login
- **Dish database: 150+ dishes before launch** (not a post-launch iteration — this is a launch blocker), weighted toward Kerala/South Indian dishes per Section 4, spanning all meal types and diet types (veg/vegan/egg/non-veg), calorie/macro values validated against IFCT
- Weekly plan generation + dish swap
- Basic dashboard (view plan, mark meals as eaten)
- Privacy policy, terms, medical disclaimer
- Photo-based meal logging: dish-matching + portion-estimate vision flow, confirmation/correction screen, unmatched-item review queue (Section 6.5)
- Workout module: bodyweight circuit, injury-based exercise substitution, daily reminder email (Section 6.6)
- Admin portal: dashboard, users, dish database, review queue, RLS-gated (Section 6.7)

Note: because the 150+ dish requirement is data-entry-heavy and accuracy-sensitive, plan for it to run in parallel with Phase 1–2 engineering work (see build prompt) rather than serially blocking the whole timeline.

**Explicitly out of scope for MVP:**
- Payment/subscription processing
- Social features, sharing, referrals
- Grocery list generation
- Barcode scanning / packaged food logging
- Integration with fitness trackers/wearables
- Multi-language support (English only at launch)
- In-app workout streak UI (v1 tracks completion server-side for the reminder email only — see Section 6.6)
- 3D exercise animation (2D stick-figure only for v1 — see Section 6.6)

## 10. Non-Goals

- FITTAYI is not a clinical nutrition or eating-disorder treatment tool. It should not accept users who indicate a diagnosed eating disorder into the standard flow — this needs a defined handling path (at minimum: don't generate a restrictive plan, direct to professional resources).
- Not a medical device; makes no diagnostic claims.
- Photo-based logging is an estimate, not a lab measurement, and is presented to users as such — it is not a substitute for the deterministic plan-generation engine in Section 6.1, and the two must never be merged into one calorie computation path.

## 11. Success Metrics (post-launch)

- Quiz completion rate
- Signup conversion rate (post sample plan)
- Day-7 / Day-30 retention
- % of plans requiring floor-clamping (signal for whether marketing is attracting people wanting unsafe deficits)
- Dish repetition rate within a 2-week window

## 12. Open Questions

- Monetization model and timing
- How to handle users who indicate a diagnosed eating disorder or are under 18
- Exact backend hosting decision (standalone Supabase vs. Lovable Cloud-equivalent) — left to Antigravity's recommendation at build time; revisit if it conflicts with self-hosting/ownership preferences later
- Which email provider sends the daily workout reminder (Section 6.6)
- Photo-matching prompt strategy at real catalog size: the reference implementations vocabulary-list every dish (fine at ~15); the live `dishes` table has 210+. Send the full catalog as prompt context every request, or pre-filter (e.g. by meal type / time of day) first? Affects both per-request cost and match accuracy — needs a decision before the Edge Function's prompt-construction logic is finalized.
- Timezone boundary for "today" in the workout reminder cron and completion tracking (IST, given Kerala-first launch, is the working assumption — not yet explicitly confirmed)
