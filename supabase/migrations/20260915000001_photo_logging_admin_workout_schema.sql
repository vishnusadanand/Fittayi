-- Schema additions for photo-based meal logging, admin portal, and the
-- workout module (FITTAYI_PRD.md v1.1 Sections 6.5-6.7).
-- RLS for these tables lives in the next migration, not here, matching the
-- split already established by 20260709000001/20260709000002.

-- ---------------------------------------------------------------------------
-- dishes: alias support so photo-matching can catch synonym gaps
-- ("green chutney" vs "coriander chutney") before treating something as a
-- genuinely new dish.
-- ---------------------------------------------------------------------------
alter table dishes add column aliases text[];

-- ---------------------------------------------------------------------------
-- user_profiles: fields needed for the admin Users tab and workout
-- substitution logic. conditions is text[] (multi-select — a user can have
-- more than one condition), not a single value.
-- ---------------------------------------------------------------------------
alter table user_profiles add column body_fat_pct numeric(4,1);
alter table user_profiles add column conditions text[] not null default '{}';
alter table user_profiles add column is_admin boolean not null default false;

-- ---------------------------------------------------------------------------
-- unmatched_food_events: a log table, not a mutable counter. Admin "times
-- flagged" is `count(*) group by seen_as` over this table, avoiding the
-- race condition a stored counter would have under concurrent uploads.
-- ---------------------------------------------------------------------------
create table unmatched_food_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  seen_as text not null,
  estimate jsonb,                     -- {calories, protein_g, carbs_g, fat_g, fiber_g}
  status text not null default 'open' check (status in ('open', 'dismissed', 'resolved')),
  created_at timestamptz default now()
);

create index idx_unmatched_food_events_status on unmatched_food_events (status);
create index idx_unmatched_food_events_seen_as on unmatched_food_events (seen_as);

-- ---------------------------------------------------------------------------
-- meal_logs: confirmed photo-logged entries. Macros are a snapshot computed
-- at logging time (dish value x portion_multiplier, done server-side) —
-- same "snapshot, not a live join" pattern as user_plans.actual_calories,
-- so a later correction to a dish's catalog numbers doesn't retroactively
-- rewrite someone's food history. dish_id is nullable: an unmatched item can
-- still be confirmed and logged with its one-off estimate.
-- ---------------------------------------------------------------------------
create table meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  dish_id uuid references dishes(id),
  seen_as text not null,
  portion_multiplier numeric(4,2),
  calories numeric(6,1) not null,
  protein_g numeric(5,1) not null,
  carbs_g numeric(5,1) not null,
  fat_g numeric(5,1) not null,
  fiber_g numeric(5,1),
  confidence text check (confidence in ('high', 'medium', 'low')),
  photo_storage_path text,
  logged_at timestamptz default now()
);

create index idx_meal_logs_user_logged_at on meal_logs (user_id, logged_at);

-- ---------------------------------------------------------------------------
-- workout_completions: one row per user per completed day. No streak_count
-- column — v1 has no in-app streak UI (PRD Section 6.6); this table exists
-- solely so the daily reminder cron job can query who hasn't completed
-- today.
-- ---------------------------------------------------------------------------
create table workout_completions (
  user_id uuid references auth.users(id) on delete cascade,
  completed_date date not null,
  primary key (user_id, completed_date)
);
