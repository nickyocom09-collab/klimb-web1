-- ============================================================================
-- Klimb — Feature migration 0002
-- Adds: climbing type, video uploads, grade-system + theme prefs, pre-populated
-- gyms with approval workflow, community route reports + auto-hide, per-user
-- daily route rate limiting, and one-send-per-route.
--
-- Run in Supabase dashboard: SQL Editor → New query → paste → Run.
-- Targets the live `profiles`-based schema. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Climbing type enum + columns on routes
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'climbing_type') then
    create type climbing_type as enum ('boulder', 'toprope');
  end if;
end$$;

alter table public.routes
  add column if not exists climbing_type climbing_type not null default 'boulder';

-- Video upload (stored in the route-photos bucket). Photo stays required.
alter table public.routes
  add column if not exists video_url text;

-- Community-report auto-hide flag (separate from the gone/archive lifecycle).
alter table public.routes
  add column if not exists hidden boolean not null default false;

alter table public.routes
  add column if not exists report_count integer not null default 0;

-- ----------------------------------------------------------------------------
-- 2. Grade scale: relax the V0..V17 check so top-rope ordinals (0..28) fit.
--    Grades are stored as an ordinal index into the route type's canonical
--    scale (boulder 0..17, toprope 0..28).
-- ----------------------------------------------------------------------------
alter table public.grades drop constraint if exists grades_grade_check;
alter table public.grades add constraint grades_grade_check
  check (grade between 0 and 40);

-- ----------------------------------------------------------------------------
-- 3. User preferences on profiles
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists grade_system text not null default 'american'
    check (grade_system in ('american', 'european'));

alter table public.profiles
  add column if not exists theme text not null default 'dark'
    check (theme in ('dark', 'light'));

alter table public.profiles
  add column if not exists default_climb_filter text not null default 'all'
    check (default_climb_filter in ('all', 'boulder', 'toprope'));

-- ----------------------------------------------------------------------------
-- 4. Gyms: brand, coordinates, approval status
-- ----------------------------------------------------------------------------
alter table public.gyms
  add column if not exists brand text;
alter table public.gyms
  add column if not exists latitude double precision;
alter table public.gyms
  add column if not exists longitude double precision;
alter table public.gyms
  add column if not exists status text not null default 'approved'
    check (status in ('pending', 'approved'));

-- Existing user-created gyms stay visible.
update public.gyms set status = 'approved' where status is null;

-- Only approved gyms are selectable. Replace the open select policy.
drop policy if exists gyms_select on public.gyms;
create policy gyms_select on public.gyms
  for select to authenticated using (status = 'approved');

-- User-suggested gyms must come in as pending and owned by the suggester.
drop policy if exists gyms_insert on public.gyms;
create policy gyms_insert on public.gyms
  for insert to authenticated
  with check (auth.uid() = created_by and status = 'pending');

-- ----------------------------------------------------------------------------
-- 5. Community route reports (wrong gym / duplicate / inappropriate)
-- ----------------------------------------------------------------------------
create table if not exists public.route_reports (
  id         uuid primary key default gen_random_uuid(),
  route_id   uuid not null references public.routes (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  reason     text not null check (reason in ('wrong_gym', 'duplicate', 'inappropriate')),
  created_at timestamptz not null default now(),
  unique (route_id, user_id)
);

alter table public.route_reports enable row level security;

drop policy if exists route_reports_select on public.route_reports;
create policy route_reports_select on public.route_reports
  for select to authenticated using (auth.uid() = user_id);

-- Reports are written via the RPC below (security definer), so no insert policy.

create or replace function public.report_route(p_route_id uuid, p_reason text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_reason not in ('wrong_gym', 'duplicate', 'inappropriate') then
    raise exception 'invalid reason';
  end if;

  insert into public.route_reports (route_id, user_id, reason)
  values (p_route_id, auth.uid(), p_reason)
  on conflict (route_id, user_id) do nothing;

  update public.routes r
    set report_count = (
      select count(*) from public.route_reports rr where rr.route_id = p_route_id
    )
    where r.id = p_route_id
    returning r.report_count into v_count;

  if v_count >= 3 then
    update public.routes set hidden = true where id = p_route_id;
  end if;

  return coalesce(v_count, 0);
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. Rate limit: max 10 routes per user per day (enforced server-side)
-- ----------------------------------------------------------------------------
create or replace function public.enforce_route_rate_limit()
returns trigger
language plpgsql
as $$
declare
  v_today integer;
begin
  select count(*) into v_today
    from public.routes
    where created_by = new.created_by
      and created_at >= date_trunc('day', now());
  if v_today >= 10 then
    raise exception 'rate_limit: you can add at most 10 routes per day';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_routes_rate_limit on public.routes;
create trigger trg_routes_rate_limit
  before insert on public.routes
  for each row execute function public.enforce_route_rate_limit();

-- ----------------------------------------------------------------------------
-- 7. One send per route per user
-- ----------------------------------------------------------------------------
delete from public.sends s
  using public.sends d
  where s.route_id = d.route_id
    and s.user_id = d.user_id
    and s.id > d.id; -- drop duplicate sends, keep earliest

create unique index if not exists uniq_sends_route_user
  on public.sends (route_id, user_id);

-- ----------------------------------------------------------------------------
-- 8. Storage: allow video mime types in the existing route-photos bucket.
--    (Bucket already public; INSERT policy already allows authenticated.)
-- ----------------------------------------------------------------------------
-- No DDL needed — the existing "route photos authenticated insert" policy
-- covers videos since it keys on bucket_id only.

-- ----------------------------------------------------------------------------
-- 9. Feed should exclude hidden routes. (Handled client-side via .eq('hidden',
--    false); the routes_select policy stays permissive so owners/mods can still
--    fetch a hidden route by id.)
-- ----------------------------------------------------------------------------
create index if not exists idx_routes_feed
  on public.routes (gym_id, status, hidden, climbing_type);
