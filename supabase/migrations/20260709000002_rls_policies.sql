-- Row Level Security
-- Catalog tables (dishes, dish_ingredients, meal_split_config) are public-read,
-- writable only by the service role (used by admin/seed scripts), so no
-- write policies are defined for anon/authenticated roles.
-- User-owned tables (user_profiles, user_plans, user_dish_history) are
-- readable/writable only by their owning user, per PRD 6.3.

alter table dishes enable row level security;
alter table dish_ingredients enable row level security;
alter table meal_split_config enable row level security;
alter table user_profiles enable row level security;
alter table user_plans enable row level security;
alter table user_dish_history enable row level security;

-- ---------------------------------------------------------------------------
-- Catalog: public read, no client writes
-- ---------------------------------------------------------------------------
create policy "dishes_public_read" on dishes
  for select using (is_active = true);

create policy "dish_ingredients_public_read" on dish_ingredients
  for select using (
    exists (select 1 from dishes d where d.id = dish_ingredients.dish_id and d.is_active = true)
  );

create policy "meal_split_config_public_read" on meal_split_config
  for select using (is_active = true);

-- ---------------------------------------------------------------------------
-- user_profiles: strictly own row only
-- ---------------------------------------------------------------------------
create policy "user_profiles_select_own" on user_profiles
  for select using (auth.uid() = user_id);

create policy "user_profiles_insert_own" on user_profiles
  for insert with check (auth.uid() = user_id);

create policy "user_profiles_update_own" on user_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "user_profiles_delete_own" on user_profiles
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- user_plans: strictly own rows only
-- ---------------------------------------------------------------------------
create policy "user_plans_select_own" on user_plans
  for select using (auth.uid() = user_id);

create policy "user_plans_insert_own" on user_plans
  for insert with check (auth.uid() = user_id);

create policy "user_plans_update_own" on user_plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "user_plans_delete_own" on user_plans
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- user_dish_history: strictly own rows only (append/read/delete; no update —
-- it's an immutable log of what was served on which date)
-- ---------------------------------------------------------------------------
create policy "user_dish_history_select_own" on user_dish_history
  for select using (auth.uid() = user_id);

create policy "user_dish_history_insert_own" on user_dish_history
  for insert with check (auth.uid() = user_id);

create policy "user_dish_history_delete_own" on user_dish_history
  for delete using (auth.uid() = user_id);
