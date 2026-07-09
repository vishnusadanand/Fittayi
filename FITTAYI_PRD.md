# FITTAYI — Product Requirements Document

**Version:** 1.0
**Owner:** ViSa
**Status:** Draft for build handoff (Google Antigravity)

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

## 9. MVP Scope (Phase 1 — build this first)

**In scope:**
- Quiz → calorie/macro engine → sample one-day plan (no signup)
- Signup/login
- **Dish database: 150+ dishes before launch** (not a post-launch iteration — this is a launch blocker), weighted toward Kerala/South Indian dishes per Section 4, spanning all meal types and diet types (veg/vegan/egg/non-veg), calorie/macro values validated against IFCT
- Weekly plan generation + dish swap
- Basic dashboard (view plan, mark meals as eaten)
- Privacy policy, terms, medical disclaimer

Note: because the 150+ dish requirement is data-entry-heavy and accuracy-sensitive, plan for it to run in parallel with Phase 1–2 engineering work (see build prompt) rather than serially blocking the whole timeline.

**Explicitly out of scope for MVP:**
- Payment/subscription processing
- Social features, sharing, referrals
- Grocery list generation
- Barcode scanning / packaged food logging
- Integration with fitness trackers/wearables
- Multi-language support (English only at launch)

## 10. Non-Goals

- FITTAYI is not a clinical nutrition or eating-disorder treatment tool. It should not accept users who indicate a diagnosed eating disorder into the standard flow — this needs a defined handling path (at minimum: don't generate a restrictive plan, direct to professional resources).
- Not a medical device; makes no diagnostic claims.

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
