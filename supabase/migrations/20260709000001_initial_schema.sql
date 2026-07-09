-- FITTAYI initial schema
-- Follows PRD Section 8.1 exactly for dishes / dish_ingredients / user_plans / user_dish_history.
-- Two tables are additions beyond the literal PRD spec, flagged to the product owner:
--   1. user_profiles     - needed to persist quiz biometrics/preferences so plans can be
--                          generated/regenerated without re-running the quiz every time.
--   2. meal_split_config - required by PRD 6.1 ("must be stored as a configurable table,
--                          not hardcoded") but not included in the 8.1 SQL listing.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Dish catalog
-- ---------------------------------------------------------------------------
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
  updated_at timestamptz default now(),
  constraint dishes_diet_type_check check (diet_type in ('veg', 'vegan', 'egg', 'non_veg')),
  constraint dishes_meal_type_check check (
    meal_type <@ array['breakfast', 'lunch', 'dinner', 'snack']::text[]
  )
);

create table dish_ingredients (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid references dishes(id) on delete cascade,
  ingredient_name text not null,
  quantity text,
  is_optional boolean default false
);

-- ---------------------------------------------------------------------------
-- Meal distribution config (PRD 6.1: configurable, not hardcoded)
-- ---------------------------------------------------------------------------
create table meal_split_config (
  meal_slot text primary key check (meal_slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  pct numeric(4,3) not null check (pct > 0 and pct <= 1),
  is_active boolean default true,
  updated_at timestamptz default now()
);

insert into meal_split_config (meal_slot, pct) values
  ('breakfast', 0.25),
  ('lunch', 0.35),
  ('dinner', 0.30),
  ('snack', 0.10);

-- ---------------------------------------------------------------------------
-- User profile (addition beyond PRD 8.1 — see header note)
-- Stores latest quiz answers/biometrics so a weekly plan can be generated or
-- regenerated without re-asking the quiz. One row per user.
-- ---------------------------------------------------------------------------
create table user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sex text not null check (sex in ('male', 'female')),
  age int not null check (age >= 13 and age <= 100),
  height_cm numeric(5,1) not null,
  weight_kg numeric(5,1) not null,
  activity_level text not null check (
    activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')
  ),
  goal text not null check (goal in ('cut', 'cut_aggressive', 'maintain', 'build', 'recomp')),
  diet_type text not null check (diet_type in ('veg', 'vegan', 'egg', 'non_veg')),
  allergens text[] default '{}',
  cuisine_region_pref text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Generated plans (RLS: user can only access own rows)
-- ---------------------------------------------------------------------------
create table user_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  plan_date date not null,
  meal_slot text not null,
  dish_id uuid references dishes(id),
  target_calories numeric,
  actual_calories numeric,            -- snapshot at generation time
  eaten_at timestamptz,
  created_at timestamptz default now(),
  constraint user_plans_meal_slot_check check (
    meal_slot in ('breakfast', 'lunch', 'dinner', 'snack')
  )
);

create table user_dish_history (
  user_id uuid references auth.users(id),
  dish_id uuid references dishes(id),
  served_on date not null,
  primary key (user_id, dish_id, served_on)
);

-- ---------------------------------------------------------------------------
-- Indexes (all from PRD 8.1, plus composite indexes for the RLS-scoped
-- lookup patterns the app will actually run: "this user's plan for this
-- week" and "this user's dish history in the last N days")
-- ---------------------------------------------------------------------------
create index idx_dishes_meal_type on dishes using gin (meal_type);
create index idx_dishes_diet_type on dishes (diet_type);
create index idx_dishes_calories on dishes (calories);
create index idx_dishes_allergens on dishes using gin (allergens);

create index idx_user_plans_user_date on user_plans (user_id, plan_date);
create index idx_user_dish_history_user_served on user_dish_history (user_id, served_on);
