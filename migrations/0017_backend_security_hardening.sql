-- Klimb pre-release backend hardening.
--
-- Public storage buckets do not need a broad SELECT policy for getPublicUrl()
-- links to work. Removing these policies prevents clients from listing every
-- object name in the bucket while keeping individual public image URLs usable.
drop policy if exists "avatars public read" on storage.objects;
drop policy if exists "route photos public read" on storage.objects;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. That is
-- especially risky for SECURITY DEFINER functions because they run with their
-- owner's privileges. Remove inherited anonymous access from every current
-- SECURITY DEFINER function in the exposed public schema, then restore access
-- only for RPCs the signed-in app intentionally calls.
do $$
declare
  fn record;
  authenticated_rpc_names constant text[] := array[
    'delete_account',
    'delete_route',
    'report_content',
    'report_route',
    'report_route_gone',
    'set_gym_grade'
  ];
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

    if fn.function_name = any(authenticated_rpc_names) then
      execute format(
        'grant execute on function %I.%I(%s) to authenticated',
        fn.schema_name,
        fn.function_name,
        fn.identity_arguments
      );
    end if;
  end loop;
end;
$$;

-- Prevent the same unsafe default from returning on future migrations.
alter default privileges in schema public
  revoke execute on functions from public;
