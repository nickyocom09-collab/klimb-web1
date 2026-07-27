-- Enable the third discipline already supported by the Klimb client.
-- Safe to run more than once.

do $$
begin
  if exists (
    select 1
    from pg_type
    where typname = 'climbing_type'
  ) and not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'climbing_type'
      and e.enumlabel = 'lead'
  ) then
    alter type public.climbing_type add value 'lead';
  end if;
end
$$;

-- Older installs constrained the user's default filter to boulder/top rope.
-- Rebuild the check so Lead can be saved as a preference too.
alter table public.profiles
  drop constraint if exists profiles_default_climb_filter_check;

alter table public.profiles
  add constraint profiles_default_climb_filter_check
  check (default_climb_filter in ('all', 'boulder', 'toprope', 'lead'));
