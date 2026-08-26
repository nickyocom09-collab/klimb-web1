-- Requested August 17 launch-day updates:
--   * every verified account created during August 17, 2026 in Chicago gets
--     permanent Pro (not merely the first 100 after 11 AM);
--   * expose only a safe Pro/not-Pro bit for profile badges;
--   * make new user-submitted gyms require a city;
--   * add Insight's two verified Washington locations; and
--   * make friend push notifications open the exact account involved.

begin;

-- The older first-100 allocator has no end time. Retire it so the public
-- promise is exactly the launch-day window below. Already granted lifetime
-- access is intentionally permanent and is never revoked.
update public.founder_campaigns
set enabled = false,
    updated_at = now()
where campaign = 'public_launch_2026';

update public.entitlement_config
set founders_lifetime_pro_enabled = false,
    updated_at = now()
where singleton = true;

create or replace function public.grant_launch_day_lifetime_pro(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_created_at timestamptz;
  v_verified_at timestamptz;
  v_previous jsonb;
  v_granted_at timestamptz := now();
begin
  select u.created_at, u.email_confirmed_at
    into v_created_at, v_verified_at
  from auth.users u
  where u.id = p_user_id
    and u.deleted_at is null;

  -- August 17, midnight-to-midnight in America/Chicago (CDT, UTC-5).
  if v_created_at is null
     or v_verified_at is null
     or v_created_at < timestamptz '2026-08-17 05:00:00+00'
     or v_created_at >= timestamptz '2026-08-18 05:00:00+00' then
    return false;
  end if;

  -- Never duplicate grants/audit events, and never downgrade another lifetime
  -- entitlement source.
  if exists (
    select 1 from public.user_entitlements e
    where e.user_id = p_user_id and e.is_lifetime_pro
  ) then
    return true;
  end if;

  select to_jsonb(e) into v_previous
  from public.user_entitlements e
  where e.user_id = p_user_id;

  insert into public.user_entitlements (
    user_id,
    plan,
    entitlement_type,
    entitlement_status,
    is_lifetime_pro,
    founder_granted_at,
    last_verified_at
  ) values (
    p_user_id,
    'lifetime_pro',
    'founder',
    'active',
    true,
    v_granted_at,
    v_granted_at
  )
  on conflict (user_id) do update
  set plan = 'lifetime_pro',
      entitlement_type = 'founder',
      entitlement_status = 'active',
      is_lifetime_pro = true,
      founder_granted_at = coalesce(
        public.user_entitlements.founder_granted_at,
        excluded.founder_granted_at
      ),
      last_verified_at = excluded.last_verified_at;

  insert into public.entitlement_audit_log (
    target_user_id, action, previous_value, new_value, reason
  )
  select
    p_user_id,
    'founder_lifetime_pro_granted',
    v_previous,
    to_jsonb(e),
    'Verified account created during the August 17, 2026 America/Chicago launch day.'
  from public.user_entitlements e
  where e.user_id = p_user_id;

  insert into public.entitlement_analytics_events (
    user_id, event_name, properties
  ) values (
    p_user_id,
    'founder_lifetime_pro_granted',
    jsonb_build_object(
      'campaign', 'launch_day_2026_08_17',
      'timezone', 'America/Chicago'
    )
  );

  return true;
end;
$$;

-- Preserve both existing trigger names. Profiles catch OAuth/auto-confirmed
-- accounts; the auth.users trigger catches email accounts confirmed later.
create or replace function public.grant_founder_lifetime_pro()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  perform public.grant_launch_day_lifetime_pro(new.id);

  insert into public.user_entitlements (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.grant_launch_day_lifetime_pro(uuid)
  from public, anon, authenticated;
revoke all on function public.grant_founder_lifetime_pro()
  from public, anon, authenticated;

-- Backfill everyone already verified during today's complete local-day window.
do $$
declare
  v_user record;
begin
  for v_user in
    select u.id
    from auth.users u
    join public.profiles p on p.id = u.id
    where u.deleted_at is null
      and u.email_confirmed_at is not null
      and u.created_at >= timestamptz '2026-08-17 05:00:00+00'
      and u.created_at < timestamptz '2026-08-18 05:00:00+00'
    order by u.created_at, u.id
  loop
    perform public.grant_launch_day_lifetime_pro(v_user.id);
  end loop;
end;
$$;

-- Only reveal the status bit needed for a badge; billing dates, transaction
-- IDs, and entitlement sources remain private to the account owner.
create or replace function public.get_pro_badges(p_user_ids uuid[])
returns table(user_id uuid, is_pro boolean)
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    p.id as user_id,
    coalesce(
      e.is_lifetime_pro
      or (
        e.entitlement_status in ('active', 'trial', 'grace_period')
        and (e.expiration_date is null or e.expiration_date > now())
      ),
      false
    ) as is_pro
  from public.profiles p
  join (select distinct unnest(p_user_ids) as id) requested on requested.id = p.id
  left join public.user_entitlements e on e.user_id = p.id
  where auth.uid() is not null;
$$;

revoke all on function public.get_pro_badges(uuid[]) from public, anon;
grant execute on function public.get_pro_badges(uuid[]) to authenticated;

-- Existing pending suggestions without a city can still be approved. Every
-- new or edited user suggestion must include one, even if an old client tries
-- to bypass the updated form.
alter table public.gyms
  drop constraint if exists gyms_user_suggestion_city_required;
alter table public.gyms
  add constraint gyms_user_suggestion_city_required check (
    status <> 'pending'
    or created_by is null
    or nullif(btrim(city), '') is not null
  ) not valid;

-- Addresses are from Insight Climbing & Movement's official locations list;
-- coordinates are the matching OpenStreetMap features.
with incoming(name, address, city, state, country, cc, brand, latitude, longitude) as (
  values
    ('Insight Climbing & Movement - Bremerton', '2315 Burwell St', 'Bremerton', 'WA', 'United States', 'us', 'Insight Climbing & Movement', 47.5653285, -122.6496489),
    ('Insight Climbing & Movement - Bainbridge Island', '9437 Coppertop Loop NE', 'Bainbridge Island', 'WA', 'United States', 'us', 'Insight Climbing & Movement', 47.6488487, -122.5240863)
)
update public.gyms g
set name = i.name,
    address = i.address,
    country = i.country,
    cc = i.cc,
    brand = i.brand,
    latitude = i.latitude,
    longitude = i.longitude,
    status = 'approved'
from incoming i
where lower(btrim(g.city)) = lower(i.city)
  and upper(btrim(g.state)) = i.state
  and (
    lower(g.name) like '%insight climbing%'
    or (i.city = 'Bainbridge Island' and lower(g.name) like '%island rock%')
  );

with incoming(name, address, city, state, country, cc, brand, latitude, longitude) as (
  values
    ('Insight Climbing & Movement - Bremerton', '2315 Burwell St', 'Bremerton', 'WA', 'United States', 'us', 'Insight Climbing & Movement', 47.5653285, -122.6496489),
    ('Insight Climbing & Movement - Bainbridge Island', '9437 Coppertop Loop NE', 'Bainbridge Island', 'WA', 'United States', 'us', 'Insight Climbing & Movement', 47.6488487, -122.5240863)
)
insert into public.gyms (
  name, address, city, state, country, cc, brand, latitude, longitude,
  status, grading_style
)
select
  i.name, i.address, i.city, i.state, i.country, i.cc, i.brand,
  i.latitude, i.longitude, 'approved', 'classic'
from incoming i
where not exists (
  select 1 from public.gyms g
  where lower(btrim(g.city)) = lower(i.city)
    and upper(btrim(g.state)) = i.state
    and (
      lower(g.name) like '%insight climbing%'
      or (i.city = 'Bainbridge Island' and lower(g.name) like '%island rock%')
    )
);

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
      'New friend request',
      coalesce(v_name, 'A climber') || ' wants to connect on Klimb.',
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
      'Friend request accepted',
      'You and ' || coalesce(v_name, 'a climber') || ' are now friends.',
      '/u/' || new.addressee_id::text,
      jsonb_build_object('friendship_id', new.id, 'actor_id', new.addressee_id),
      'friend-accept:' || new.id::text
    ) on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

-- Repair queued-but-not-yet-sent friend pushes too.
update public.push_events
set link = '/u/' || (data ->> 'actor_id')
where processed_at is null
  and kind in ('friend_request', 'friend_accept')
  and (data ->> 'actor_id') ~* '^[0-9a-f-]{36}$';

revoke all on function public.queue_friendship_push()
  from public, anon, authenticated;

commit;
