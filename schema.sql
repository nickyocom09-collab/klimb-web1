-- ============================================================================
-- Klimb — Supabase schema
-- Run this in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE where possible).
-- ============================================================================

-- Extensions ----------------------------------------------------------------
create extension if not exists "pgcrypto";

-- Enums ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'route_status') then
    create type route_status as enum ('active', 'archived');
  end if;
end$$;

-- Tables --------------------------------------------------------------------

-- Profiles. id mirrors auth.users.id.
create table if not exists public.users (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  display_name text not null,
  home_gym_id  uuid,
  created_at   timestamptz not null default now()
);

create table if not exists public.gyms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  city       text,
  state      text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Add the FK from users -> gyms after gyms exists.
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'users_home_gym_id_fkey'
  ) then
    alter table public.users
      add constraint users_home_gym_id_fkey
      foreign key (home_gym_id) references public.gyms (id) on delete set null;
  end if;
end$$;

create table if not exists public.routes (
  id               uuid primary key default gen_random_uuid(),
  gym_id           uuid not null references public.gyms (id) on delete cascade,
  photo_url        text not null,
  hold_color       text not null,
  wall_section     text not null,
  description      text,
  status           route_status not null default 'active',
  gone_reports     integer not null default 0,
  created_by       uuid references public.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  archived_at      timestamptz,
  last_activity_at timestamptz not null default now()
);

create table if not exists public.grades (
  id         uuid primary key default gen_random_uuid(),
  route_id   uuid not null references public.routes (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  grade      integer not null check (grade between 0 and 17),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (route_id, user_id)
);

create table if not exists public.sends (
  id         uuid primary key default gen_random_uuid(),
  route_id   uuid not null references public.routes (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  route_id   uuid not null references public.routes (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  body       text not null,
  is_beta    boolean not null default false,
  upvotes    integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.gone_reports (
  id         uuid primary key default gen_random_uuid(),
  route_id   uuid not null references public.routes (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (route_id, user_id)
);

-- Indexes -------------------------------------------------------------------
create index if not exists idx_routes_gym_status on public.routes (gym_id, status);
create index if not exists idx_routes_last_activity on public.routes (last_activity_at);
create index if not exists idx_grades_route on public.grades (route_id);
create index if not exists idx_sends_route on public.sends (route_id);
create index if not exists idx_sends_user on public.sends (user_id);
create index if not exists idx_comments_route on public.comments (route_id);

-- ============================================================================
-- Activity tracking: bump routes.last_activity_at on new grade / send.
-- ============================================================================
create or replace function public.bump_route_activity()
returns trigger
language plpgsql
as $$
begin
  update public.routes
    set last_activity_at = now()
    where id = new.route_id;
  return new;
end;
$$;

drop trigger if exists trg_grades_activity on public.grades;
create trigger trg_grades_activity
  after insert or update on public.grades
  for each row execute function public.bump_route_activity();

drop trigger if exists trg_sends_activity on public.sends;
create trigger trg_sends_activity
  after insert on public.sends
  for each row execute function public.bump_route_activity();

-- ============================================================================
-- RPC: report a route as gone. One report per user; archives at 3 reports.
-- SECURITY DEFINER so it can update the shared counter past row RLS.
-- Returns the new gone_reports count.
-- ============================================================================
create or replace function public.report_route_gone(p_route_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.gone_reports (route_id, user_id)
  values (p_route_id, auth.uid())
  on conflict (route_id, user_id) do nothing;

  update public.routes r
    set gone_reports = (
      select count(*) from public.gone_reports gr where gr.route_id = p_route_id
    )
    where r.id = p_route_id
    returning r.gone_reports into v_count;

  if v_count >= 3 then
    update public.routes
      set status = 'archived', archived_at = now()
      where id = p_route_id and status <> 'archived';
  end if;

  return coalesce(v_count, 0);
end;
$$;

-- ============================================================================
-- RPC: auto-archive routes with no activity for 90 days.
-- Call from a scheduled job (pg_cron) or manually.
-- ============================================================================
create or replace function public.archive_stale_routes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with updated as (
    update public.routes
      set status = 'archived', archived_at = now()
      where status = 'active'
        and last_activity_at < now() - interval '90 days'
      returning 1
  )
  select count(*) into v_count from updated;
  return v_count;
end;
$$;

-- Optional: schedule daily auto-archive (requires pg_cron extension).
-- select cron.schedule('klimb-archive-stale', '0 4 * * *', $$select public.archive_stale_routes();$$);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.users        enable row level security;
alter table public.gyms         enable row level security;
alter table public.routes       enable row level security;
alter table public.grades       enable row level security;
alter table public.sends        enable row level security;
alter table public.comments     enable row level security;
alter table public.gone_reports enable row level security;

-- users: anyone authenticated can read profiles; you manage only your own.
drop policy if exists users_select on public.users;
create policy users_select on public.users
  for select to authenticated using (true);

drop policy if exists users_insert_self on public.users;
create policy users_insert_self on public.users
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- gyms: read all; any authenticated user can add a gym.
drop policy if exists gyms_select on public.gyms;
create policy gyms_select on public.gyms
  for select to authenticated using (true);

drop policy if exists gyms_insert on public.gyms;
create policy gyms_insert on public.gyms
  for insert to authenticated with check (auth.uid() = created_by);

-- routes: read all; create your own; update only your own (e.g. edits).
drop policy if exists routes_select on public.routes;
create policy routes_select on public.routes
  for select to authenticated using (true);

drop policy if exists routes_insert on public.routes;
create policy routes_insert on public.routes
  for insert to authenticated with check (auth.uid() = created_by);

drop policy if exists routes_update_owner on public.routes;
create policy routes_update_owner on public.routes
  for update to authenticated using (auth.uid() = created_by) with check (auth.uid() = created_by);

-- grades: read all; insert/update/delete only your own.
drop policy if exists grades_select on public.grades;
create policy grades_select on public.grades
  for select to authenticated using (true);

drop policy if exists grades_insert_self on public.grades;
create policy grades_insert_self on public.grades
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists grades_update_self on public.grades;
create policy grades_update_self on public.grades
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists grades_delete_self on public.grades;
create policy grades_delete_self on public.grades
  for delete to authenticated using (auth.uid() = user_id);

-- sends: read all; insert your own. Sends persist permanently (no delete policy).
drop policy if exists sends_select on public.sends;
create policy sends_select on public.sends
  for select to authenticated using (true);

drop policy if exists sends_insert_self on public.sends;
create policy sends_insert_self on public.sends
  for insert to authenticated with check (auth.uid() = user_id);

-- comments: read all; insert your own; update your own (e.g. edit / upvote handled via RPC later).
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
  for select to authenticated using (true);

drop policy if exists comments_insert_self on public.comments;
create policy comments_insert_self on public.comments
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists comments_update on public.comments;
create policy comments_update on public.comments
  for update to authenticated using (true) with check (true);

-- gone_reports: managed exclusively through the report_route_gone RPC.
drop policy if exists gone_reports_select on public.gone_reports;
create policy gone_reports_select on public.gone_reports
  for select to authenticated using (auth.uid() = user_id);

-- ============================================================================
-- Storage: public bucket for route photos.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('route-photos', 'route-photos', true)
on conflict (id) do nothing;

drop policy if exists "route photos public read" on storage.objects;
create policy "route photos public read" on storage.objects
  for select using (bucket_id = 'route-photos');

drop policy if exists "route photos authenticated insert" on storage.objects;
create policy "route photos authenticated insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'route-photos');
