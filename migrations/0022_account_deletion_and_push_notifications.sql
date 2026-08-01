-- Reliable account deletion plus the server-side push notification queue.

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Community routes and gym suggestions intentionally remain available. Their
  -- foreign keys use ON DELETE SET NULL, while every personal table attached to
  -- the profile uses ON DELETE CASCADE.
  delete from public.profiles where id = v_user_id;

  -- Tables attached directly to auth.users (personal_logs, entitlements,
  -- tokens, preferences, and audit rows) cascade from this final delete.
  delete from auth.users where id = v_user_id;

  if found then
    return;
  end if;
  raise exception 'Account could not be deleted';
end;
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null default 'ios' check (platform in ('ios')),
  environment text not null default 'production'
    check (environment in ('development', 'production')),
  timezone text not null default 'UTC',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx
  on public.push_tokens(user_id) where enabled;

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  friend_requests boolean not null default true,
  friend_accepts boolean not null default true,
  weekly_recaps boolean not null default true,
  streak_risk boolean not null default true,
  inactivity boolean not null default true,
  inactivity_days integer not null default 14
    check (inactivity_days between 7 and 90),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (
    kind in ('friend_request', 'friend_accept', 'weekly_recap', 'streak_risk', 'inactivity')
  ),
  title text not null,
  body text not null,
  link text not null default '/notifications',
  data jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique,
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists push_events_pending_idx
  on public.push_events(available_at, created_at)
  where processed_at is null;

alter table public.push_tokens enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_events enable row level security;

drop policy if exists push_tokens_select_own on public.push_tokens;
create policy push_tokens_select_own on public.push_tokens
  for select to authenticated using (user_id = auth.uid());

drop policy if exists push_tokens_delete_own on public.push_tokens;
create policy push_tokens_delete_own on public.push_tokens
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists notification_preferences_select_own on public.notification_preferences;
create policy notification_preferences_select_own on public.notification_preferences
  for select to authenticated using (user_id = auth.uid());

drop policy if exists notification_preferences_update_own on public.notification_preferences;
create policy notification_preferences_update_own on public.notification_preferences
  for update to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.push_tokens from anon, authenticated;
revoke all on public.notification_preferences from anon, authenticated;
revoke all on public.push_events from anon, authenticated;
grant select, delete on public.push_tokens to authenticated;
grant select, update on public.notification_preferences to authenticated;

create or replace function public.register_push_token(
  p_token text,
  p_timezone text default 'UTC',
  p_environment text default 'production'
)
returns public.push_tokens
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text := coalesce(nullif(btrim(p_timezone), ''), 'UTC');
  v_row public.push_tokens;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if nullif(btrim(p_token), '') is null or char_length(p_token) > 512 then
    raise exception 'Invalid push token';
  end if;
  if p_environment not in ('development', 'production') then
    raise exception 'Invalid APNs environment';
  end if;
  if not exists (select 1 from pg_timezone_names where name = v_timezone) then
    v_timezone := 'UTC';
  end if;

  insert into public.notification_preferences(user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  insert into public.push_tokens(
    user_id, token, platform, environment, timezone, enabled,
    updated_at, last_seen_at
  )
  values (
    v_user_id, btrim(p_token), 'ios', p_environment, v_timezone, true,
    now(), now()
  )
  on conflict (token) do update set
    user_id = excluded.user_id,
    environment = excluded.environment,
    timezone = excluded.timezone,
    enabled = true,
    updated_at = now(),
    last_seen_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.disable_push_token(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.push_tokens
     set enabled = false, updated_at = now()
   where user_id = auth.uid() and token = btrim(p_token);
$$;

create or replace function public.disable_all_push_tokens()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.push_tokens
     set enabled = false, updated_at = now()
   where user_id = auth.uid();
$$;

revoke all on function public.register_push_token(text, text, text) from public, anon;
revoke all on function public.disable_push_token(text) from public, anon;
revoke all on function public.disable_all_push_tokens() from public, anon;
grant execute on function public.register_push_token(text, text, text) to authenticated;
grant execute on function public.disable_push_token(text) to authenticated;
grant execute on function public.disable_all_push_tokens() to authenticated;

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
      '/friends',
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
      '/friends',
      jsonb_build_object('friendship_id', new.id, 'actor_id', new.addressee_id),
      'friend-accept:' || new.id::text
    ) on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists queue_friendship_push_trigger on public.friendships;
create trigger queue_friendship_push_trigger
after insert or update of status on public.friendships
for each row execute function public.queue_friendship_push();

create or replace function public.queue_weekly_recap_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.period = 'weekly' then
    insert into public.push_events(
      user_id, kind, title, body, link, data, dedupe_key
    ) values (
      new.user_id,
      'weekly_recap',
      'Your weekly recap is ready',
      'See your sends, stats, and biggest moments from the week.',
      '/stats?recap=' || new.id::text,
      jsonb_build_object('recap_id', new.id),
      'weekly-recap:' || new.id::text
    ) on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists queue_weekly_recap_push_trigger on public.recaps;
create trigger queue_weekly_recap_push_trigger
after insert or update of generated_at on public.recaps
for each row execute function public.queue_weekly_recap_push();

create or replace function public.queue_scheduled_push_events()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  with latest_device as (
    select distinct on (user_id)
      user_id, timezone
    from public.push_tokens
    where enabled
    order by user_id, last_seen_at desc
  ), activity as (
    select user_id, created_at from public.sends
    union all
    select user_id, created_at from public.personal_logs
    where transferred_at is null
  ), candidates as (
    select
      p.id as user_id,
      d.timezone,
      prefs.inactivity_days,
      prefs.inactivity,
      prefs.streak_risk,
      coalesce(max(a.created_at), p.created_at) as last_activity,
      timezone(d.timezone, now()) as local_now
    from public.profiles p
    join latest_device d on d.user_id = p.id
    join public.notification_preferences prefs on prefs.user_id = p.id
    left join activity a on a.user_id = p.id
    group by p.id, d.timezone, prefs.inactivity_days,
             prefs.inactivity, prefs.streak_risk
  ), inserted as (
    insert into public.push_events(
      user_id, kind, title, body, link, dedupe_key
    )
    select
      c.user_id,
      'inactivity',
      'The wall misses you',
      'It has been a while since your last Klimb. Ready for another session?',
      '/',
      'inactivity:' || c.user_id::text || ':' ||
        floor(extract(epoch from c.local_now) / (14 * 86400))::bigint::text
    from candidates c
    where c.inactivity
      and c.last_activity <= now() - make_interval(days => c.inactivity_days)
      and extract(hour from c.local_now) = 18
    on conflict (dedupe_key) do nothing
    returning 1
  )
  select count(*) into v_count from inserted;

  with latest_device as (
    select distinct on (user_id)
      user_id, timezone
    from public.push_tokens
    where enabled
    order by user_id, last_seen_at desc
  ), activity as (
    select user_id, created_at from public.sends
    union all
    select user_id, created_at from public.personal_logs
    where transferred_at is null
  ), candidates as (
    select
      p.id as user_id,
      d.timezone,
      timezone(d.timezone, now()) as local_now
    from public.profiles p
    join latest_device d on d.user_id = p.id
    join public.notification_preferences prefs
      on prefs.user_id = p.id and prefs.streak_risk
  ), inserted as (
    insert into public.push_events(
      user_id, kind, title, body, link, dedupe_key
    )
    select
      c.user_id,
      'streak_risk',
      'Your streak ends tonight',
      'Log a Klimb today to keep your weekly streak alive.',
      '/',
      'streak-risk:' || c.user_id::text || ':' ||
        to_char(c.local_now, 'IYYY-IW')
    from candidates c
    where extract(isodow from c.local_now) = 7
      and extract(hour from c.local_now) = 16
      and exists (
        select 1 from activity a
        where a.user_id = c.user_id
          and timezone(c.timezone, a.created_at) >=
              date_trunc('week', c.local_now) - interval '7 days'
          and timezone(c.timezone, a.created_at) < date_trunc('week', c.local_now)
      )
      and not exists (
        select 1 from activity a
        where a.user_id = c.user_id
          and timezone(c.timezone, a.created_at) >= date_trunc('week', c.local_now)
      )
    on conflict (dedupe_key) do nothing
    returning 1
  )
  select v_count + count(*) into v_count from inserted;

  return v_count;
end;
$$;

revoke all on function public.queue_friendship_push() from public, anon, authenticated;
revoke all on function public.queue_weekly_recap_push() from public, anon, authenticated;
revoke all on function public.queue_scheduled_push_events() from public, anon, authenticated;

-- Queue time-sensitive reminders hourly. A separate pg_net cron invokes the
-- push-dispatch Edge Function after its URL and shared secret are stored in
-- Vault during deployment.
select cron.schedule(
  'klimb_queue_scheduled_pushes',
  '0 * * * *',
  'select public.queue_scheduled_push_events()'
)
where not exists (
  select 1 from cron.job where jobname = 'klimb_queue_scheduled_pushes'
);
