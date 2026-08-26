-- Product/social pass: review-safe, additive schema for the next app build.
-- Do not apply while build 61 is in App Review. Apply immediately before the
-- matching TestFlight build so the new optional columns/RPC arguments exist.

alter table public.gyms
  add column if not exists address text;

-- Requested Berlin location. Coordinates are the Friedrichstrasse 76-78 /
-- Französische Strasse corner (OpenStreetMap/Nominatim).
insert into public.gyms (
  name, address, city, state, country, cc, latitude, longitude, status, grading_style
)
select
  'Underground Gym Berlin', 'Friedrichstraße / Französische Straße, 10117 Berlin',
  'Berlin', 'Berlin', 'Germany', 'de',
  52.5144220, 13.3898980, 'approved', 'classic'
where not exists (
  select 1 from public.gyms
  where lower(name) = lower('Underground Gym Berlin')
    and cc = 'de'
);

update public.gyms
set address = 'Friedrichstraße / Französische Straße, 10117 Berlin',
    city = 'Berlin', state = 'Berlin', country = 'Germany', cc = 'de',
    latitude = 52.5144220, longitude = 13.3898980, status = 'approved'
where lower(name) = lower('Underground Gym Berlin') and cc = 'de';

alter table public.profiles
  add column if not exists notes_public boolean not null default false;

alter table public.sends
  add column if not exists profile_visible boolean not null default true;

alter table public.bookmarks
  add column if not exists profile_visible boolean not null default true;

drop policy if exists project_notes_public_select on public.project_notes;
create policy project_notes_public_select on public.project_notes
  for select to authenticated using (
    user_id = auth.uid()
    or (
      exists (
        select 1 from public.profiles p
        where p.id = project_notes.user_id
          and p.projects_public
          and p.notes_public
      )
      and exists (
        select 1 from public.bookmarks b
        where b.user_id = project_notes.user_id
          and b.route_id = project_notes.route_id
          and b.kind = 'project'
          and b.profile_visible
      )
    )
  );

create index if not exists sends_public_profile_idx
  on public.sends(user_id, created_at desc)
  where profile_visible;

create index if not exists bookmarks_public_profile_idx
  on public.bookmarks(user_id, created_at desc)
  where profile_visible;

-- A gym is permanently unlocked for a user after their first verified log
-- inside the 30-mile radius. The client never stores device coordinates.
create table if not exists public.gym_unlocks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, gym_id)
);

alter table public.gym_unlocks enable row level security;

drop policy if exists gym_unlocks_select_own on public.gym_unlocks;
create policy gym_unlocks_select_own on public.gym_unlocks
  for select to authenticated using (user_id = auth.uid());

drop policy if exists gym_unlocks_insert_own on public.gym_unlocks;
create policy gym_unlocks_insert_own on public.gym_unlocks
  for insert to authenticated with check (user_id = auth.uid());

revoke all on public.gym_unlocks from anon, authenticated;
grant select, insert on public.gym_unlocks to authenticated;

-- Existing gym-linked history proves the user has already completed a first
-- log there, so those gyms start unlocked without another location prompt.
insert into public.gym_unlocks(user_id, gym_id, unlocked_at)
select s.user_id, r.gym_id, min(s.created_at)
from public.sends s
join public.routes r on r.id = s.route_id
group by s.user_id, r.gym_id
on conflict (user_id, gym_id) do nothing;

-- One lightweight reaction per person per friend activity. Keeping the
-- activity owner and route on the row makes notification routing direct and
-- avoids exposing another user's private activity through a join.
create table if not exists public.activity_reactions (
  id uuid primary key default gen_random_uuid(),
  activity_kind text not null check (activity_kind in ('send', 'project')),
  activity_id uuid not null,
  route_id uuid not null references public.routes(id) on delete cascade,
  activity_owner_id uuid not null references public.profiles(id) on delete cascade,
  reactor_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check (reaction in ('clap', 'fire', 'strong')),
  created_at timestamptz not null default now(),
  unique (activity_kind, activity_id, reactor_id),
  check (activity_owner_id <> reactor_id)
);

create index if not exists activity_reactions_activity_idx
  on public.activity_reactions(activity_kind, activity_id, created_at);
create index if not exists activity_reactions_owner_idx
  on public.activity_reactions(activity_owner_id, created_at desc);

alter table public.activity_reactions enable row level security;

drop policy if exists activity_reactions_select on public.activity_reactions;
create policy activity_reactions_select on public.activity_reactions
  for select to authenticated using (true);

drop policy if exists activity_reactions_insert_own on public.activity_reactions;
create policy activity_reactions_insert_own on public.activity_reactions
  for insert to authenticated with check (reactor_id = auth.uid());

drop policy if exists activity_reactions_update_own on public.activity_reactions;
create policy activity_reactions_update_own on public.activity_reactions
  for update to authenticated using (reactor_id = auth.uid())
  with check (reactor_id = auth.uid());

drop policy if exists activity_reactions_delete_own on public.activity_reactions;
create policy activity_reactions_delete_own on public.activity_reactions
  for delete to authenticated using (reactor_id = auth.uid());

revoke all on public.activity_reactions from anon, authenticated;
grant select, insert, update, delete on public.activity_reactions to authenticated;

-- Old builds omit p_profile_visible; its default keeps those calls working.
drop function if exists public.log_climb(
  uuid, text, text, text, integer, integer, integer, text, text, text
);

create function public.log_climb(
  p_gym_id uuid,
  p_photo_url text,
  p_hold_color text,
  p_climbing_type text,
  p_gym_grade integer,
  p_felt_grade integer,
  p_stars integer,
  p_outcome text,
  p_note text,
  p_name text default null,
  p_profile_visible boolean default true
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_route_id uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
begin
  if v_user_id is null then
    raise exception 'You must be signed in to log a Klimb.';
  end if;
  if p_climbing_type not in ('boulder', 'toprope', 'lead') then
    raise exception 'Invalid climbing type.';
  end if;
  if p_outcome not in ('flash', 'send', 'project') then
    raise exception 'Invalid Klimb outcome.';
  end if;
  if p_stars is not null and (p_stars < 1 or p_stars > 5) then
    raise exception 'Rating must be between 1 and 5.';
  end if;
  if v_name is not null and char_length(v_name) > 80 then
    raise exception 'Route names must be 80 characters or fewer.';
  end if;

  insert into public.routes (
    gym_id, photo_url, hold_color, climbing_type, gym_grade, name, created_by
  ) values (
    p_gym_id, p_photo_url, p_hold_color,
    p_climbing_type::public.climbing_type, p_gym_grade, v_name, v_user_id
  ) returning id into v_route_id;

  if p_felt_grade is not null then
    insert into public.grades(route_id, user_id, grade)
    values (v_route_id, v_user_id, p_felt_grade);
  end if;
  if p_stars is not null then
    insert into public.route_ratings(route_id, user_id, stars)
    values (v_route_id, v_user_id, p_stars);
  end if;

  if p_outcome = 'project' then
    insert into public.bookmarks(user_id, route_id, kind, profile_visible)
    values (v_user_id, v_route_id, 'project', p_profile_visible);
    if v_note is not null then
      insert into public.project_notes(user_id, route_id, body)
      values (v_user_id, v_route_id, v_note);
    end if;
  else
    insert into public.sends(
      route_id, user_id, send_type, attempts, note, profile_visible
    ) values (
      v_route_id, v_user_id, p_outcome, 1, v_note, p_profile_visible
    );
  end if;

  return v_route_id;
end;
$$;

revoke all on function public.log_climb(
  uuid, text, text, text, integer, integer, integer, text, text, text, boolean
) from public;
grant execute on function public.log_climb(
  uuid, text, text, text, integer, integer, integer, text, text, text, boolean
) to authenticated;

-- Friend-request language and its destination now match the product action.
create or replace function public.queue_friendship_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    select coalesce(nullif(display_name, ''), 'A climber')
      into v_name from public.profiles where id = new.requester_id;
    insert into public.push_events(
      user_id, kind, title, body, link, data, dedupe_key
    ) values (
      new.addressee_id,
      'friend_request',
      'Klimb together?',
      coalesce(v_name, 'A climber') || ' wants to Klimb with you.',
      '/u/' || new.requester_id::text,
      jsonb_build_object('friendship_id', new.id, 'actor_id', new.requester_id),
      'friend-request:' || new.id::text
    ) on conflict (dedupe_key) do nothing;
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    select coalesce(nullif(display_name, ''), 'A climber')
      into v_name from public.profiles where id = new.addressee_id;
    insert into public.push_events(
      user_id, kind, title, body, link, data, dedupe_key
    ) values (
      new.requester_id,
      'friend_accept',
      'Ready to Klimb',
      'You and ' || coalesce(v_name, 'a climber') || ' can Klimb together.',
      '/u/' || new.addressee_id::text,
      jsonb_build_object('friendship_id', new.id, 'actor_id', new.addressee_id),
      'friend-accept:' || new.id::text
    ) on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.queue_friendship_push() from public, anon, authenticated;
