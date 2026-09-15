-- Fixes a real bug in 20260915000002_photo_logging_admin_workout_rls.sql:
-- every admin policy checked `exists (select 1 from user_profiles p where
-- p.user_id = auth.uid() and p.is_admin)` inline. Evaluating that subquery
-- requires applying user_profiles' own RLS policies -- which include this
-- same admin check -- so Postgres hits infinite recursion (42P17) before it
-- can ever short-circuit on another OR'd policy branch. This broke SELECT
-- on user_profiles for every user, not just admins, since RLS evaluates the
-- full OR'd policy set and can't skip a policy that errors.
--
-- Standard fix: a SECURITY DEFINER function. It runs as the function owner,
-- which bypasses RLS for its own internal lookup, breaking the recursive
-- cycle. Policies call the function instead of repeating the subquery.

create or replace function is_admin(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select p.is_admin from user_profiles p where p.user_id = uid), false);
$$;

drop policy if exists "user_profiles_select_admin" on user_profiles;
drop policy if exists "user_profiles_update_admin" on user_profiles;
drop policy if exists "unmatched_food_events_select_admin" on unmatched_food_events;
drop policy if exists "unmatched_food_events_update_admin" on unmatched_food_events;
drop policy if exists "dishes_admin_insert" on dishes;
drop policy if exists "dishes_admin_update" on dishes;
drop policy if exists "dishes_admin_delete" on dishes;

create policy "user_profiles_select_admin" on user_profiles
  for select using (is_admin(auth.uid()));

create policy "user_profiles_update_admin" on user_profiles
  for update using (is_admin(auth.uid()));

create policy "unmatched_food_events_select_admin" on unmatched_food_events
  for select using (is_admin(auth.uid()));

create policy "unmatched_food_events_update_admin" on unmatched_food_events
  for update using (is_admin(auth.uid()));

create policy "dishes_admin_insert" on dishes
  for insert with check (is_admin(auth.uid()));

create policy "dishes_admin_update" on dishes
  for update using (is_admin(auth.uid()));

create policy "dishes_admin_delete" on dishes
  for delete using (is_admin(auth.uid()));
