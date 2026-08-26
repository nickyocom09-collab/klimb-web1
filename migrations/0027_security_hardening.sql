-- Defense in depth for media uploads, database grants, and SECURITY DEFINER
-- functions. Client checks improve UX; these server-side controls are what
-- stop a modified or malicious client from bypassing them.

begin;

update storage.buckets
set file_size_limit = 12582912,
    allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif'
    ]::text[]
where id = 'route-photos';

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp'
    ]::text[]
where id = 'avatars';

-- PostgREST does not expose these operations, but the mobile roles do not need
-- them and should never inherit them through a future API surface.
revoke truncate, references, trigger
  on all tables in schema public
  from anon, authenticated;

-- PostgreSQL grants function execution to PUBLIC by default. Remove anonymous
-- execution from every privileged function, including functions added after
-- the earlier hardening migration. Existing authenticated grants remain, and
-- each callable RPC still performs its own user/admin authorization checks.
do $$
declare
  fn record;
begin
  for fn in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format(
      'revoke all on function %I.%I(%s) from public, anon',
      fn.schema_name,
      fn.function_name,
      fn.identity_arguments
    );
  end loop;
end;
$$;

alter default privileges in schema public
  revoke execute on functions from public;

commit;
