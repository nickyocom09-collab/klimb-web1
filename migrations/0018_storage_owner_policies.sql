-- Restrict uploads and mutations to each authenticated user's own folder.
-- Both buckets remain public, so existing public image URLs keep working.

drop policy if exists "route photos authenticated insert" on storage.objects;
drop policy if exists "route photos owner insert" on storage.objects;
drop policy if exists "route photos owner update" on storage.objects;
drop policy if exists "route photos owner delete" on storage.objects;

create policy "route photos owner insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'route-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "route photos owner update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'route-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'route-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "route photos owner delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'route-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "avatars auth upload" on storage.objects;
drop policy if exists "avatars auth update" on storage.objects;
drop policy if exists "avatars owner insert" on storage.objects;
drop policy if exists "avatars owner update" on storage.objects;
drop policy if exists "avatars owner delete" on storage.objects;

create policy "avatars owner insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "avatars owner update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "avatars owner delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
