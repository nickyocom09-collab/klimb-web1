-- Per-account Pro log-flow customization. Core facts (climb type and outcome)
-- remain required; every optional logging field can be shown or hidden.

create table if not exists public.logbook_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  show_photo boolean not null default true,
  show_hold_color boolean not null default true,
  show_gym_grade boolean not null default true,
  show_felt_grade boolean not null default true,
  show_quality boolean not null default true,
  show_route_name boolean not null default true,
  show_note boolean not null default true,
  show_profile_visibility boolean not null default true,
  default_profile_visible boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.logbook_preferences enable row level security;

drop policy if exists logbook_preferences_select_own on public.logbook_preferences;
create policy logbook_preferences_select_own on public.logbook_preferences
  for select to authenticated using (user_id = auth.uid());

drop policy if exists logbook_preferences_insert_own on public.logbook_preferences;
create policy logbook_preferences_insert_own on public.logbook_preferences
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists logbook_preferences_update_own on public.logbook_preferences;
create policy logbook_preferences_update_own on public.logbook_preferences
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.logbook_preferences from anon;
grant select, insert, update on public.logbook_preferences to authenticated;

