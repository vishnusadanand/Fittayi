-- Storage bucket for photo-based meal logging (PRD Section 6.5). Private
-- bucket, one folder per user (meal-photos/{user_id}/{uuid}.jpg) — RLS on
-- storage.objects restricts each user to their own folder, mirroring the
-- table-level "own rows only" policies used everywhere else.

insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do nothing;

create policy "meal_photos_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "meal_photos_select_own" on storage.objects
  for select using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "meal_photos_delete_own" on storage.objects
  for delete using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
