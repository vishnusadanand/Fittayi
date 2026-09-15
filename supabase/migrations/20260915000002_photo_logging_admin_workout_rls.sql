-- RLS for the tables added in 20260915000001_photo_logging_admin_workout_schema.sql.
-- Admin access is gated by user_profiles.is_admin, checked server-side via
-- these policies — not a frontend-only check (PRD Section 6.7).

alter table unmatched_food_events enable row level security;
alter table meal_logs enable row level security;
alter table workout_completions enable row level security;

-- ---------------------------------------------------------------------------
-- unmatched_food_events: users can log their own unmatched items; only
-- admins can see the queue or change its status (dismiss/resolve).
-- ---------------------------------------------------------------------------
create policy "unmatched_food_events_insert_own" on unmatched_food_events
  for insert with check (auth.uid() = user_id);

create policy "unmatched_food_events_select_admin" on unmatched_food_events
  for select using (
    exists (select 1 from user_profiles p where p.user_id = auth.uid() and p.is_admin)
  );

create policy "unmatched_food_events_update_admin" on unmatched_food_events
  for update using (
    exists (select 1 from user_profiles p where p.user_id = auth.uid() and p.is_admin)
  );

-- ---------------------------------------------------------------------------
-- meal_logs: strictly own rows only, same pattern as user_plans.
-- ---------------------------------------------------------------------------
create policy "meal_logs_select_own" on meal_logs
  for select using (auth.uid() = user_id);

create policy "meal_logs_insert_own" on meal_logs
  for insert with check (auth.uid() = user_id);

create policy "meal_logs_update_own" on meal_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "meal_logs_delete_own" on meal_logs
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- workout_completions: strictly own rows only, same read/append/delete
-- pattern as user_dish_history (no update — a day is either completed or
-- it's deleted and re-inserted, not edited in place).
-- ---------------------------------------------------------------------------
create policy "workout_completions_select_own" on workout_completions
  for select using (auth.uid() = user_id);

create policy "workout_completions_insert_own" on workout_completions
  for insert with check (auth.uid() = user_id);

create policy "workout_completions_delete_own" on workout_completions
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- dishes: add admin write access on top of the existing public-read policy.
-- Regular authenticated users still cannot write; only is_admin can.
-- ---------------------------------------------------------------------------
create policy "dishes_admin_insert" on dishes
  for insert with check (
    exists (select 1 from user_profiles p where p.user_id = auth.uid() and p.is_admin)
  );

create policy "dishes_admin_update" on dishes
  for update using (
    exists (select 1 from user_profiles p where p.user_id = auth.uid() and p.is_admin)
  );

create policy "dishes_admin_delete" on dishes
  for delete using (
    exists (select 1 from user_profiles p where p.user_id = auth.uid() and p.is_admin)
  );

-- ---------------------------------------------------------------------------
-- user_profiles: add admin read/write across all rows, on top of the
-- existing "own row only" policies (Postgres OR's policies of the same
-- command together, so a user matches either their own-row policy or this
-- one). Powers the admin Users tab.
-- ---------------------------------------------------------------------------
create policy "user_profiles_select_admin" on user_profiles
  for select using (
    exists (select 1 from user_profiles p where p.user_id = auth.uid() and p.is_admin)
  );

create policy "user_profiles_update_admin" on user_profiles
  for update using (
    exists (select 1 from user_profiles p where p.user_id = auth.uid() and p.is_admin)
  );
