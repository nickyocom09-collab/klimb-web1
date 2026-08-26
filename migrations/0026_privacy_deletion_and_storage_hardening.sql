-- Privacy hardening: let each user enumerate only their own storage folder so
-- the app can delete all uploads, then remove user-authored media/text while
-- preserving non-personal route facts needed by other climbers' logbooks.

begin;

drop policy if exists "avatars owner select" on storage.objects;
create policy "avatars owner select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "route photos owner select" on storage.objects;
create policy "route photos owner select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'route-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_placeholder constant text := 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D''http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg''%20width%3D''400''%20height%3D''300''%3E%3Crect%20width%3D''400''%20height%3D''300''%20fill%3D''%231b1e1c''%2F%3E%3Cpath%20d%3D''M110%20205%20L175%20125%20L215%20172%20L250%20140%20L300%20205%20Z''%20fill%3D''%232a2f2c''%2F%3E%3Ccircle%20cx%3D''250''%20cy%3D''95''%20r%3D''16''%20fill%3D''%232a2f2c''%2F%3E%3C%2Fsvg%3E';
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Storage files are deleted by the authenticated client immediately before
  -- this RPC. Strip the corresponding URLs and every user-authored text field
  -- from shared route rows while retaining neutral route facts for other logs.
  update public.routes
     set photo_url = v_placeholder,
         video_url = null,
         name = null,
         description = null,
         created_by = null
   where created_by = v_user_id;

  delete from public.profiles where id = v_user_id;
  delete from auth.users where id = v_user_id;

  if found then
    return;
  end if;
  raise exception 'Account could not be deleted';
end;
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

commit;
