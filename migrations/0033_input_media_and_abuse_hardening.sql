-- Harden public/user-controlled fields against oversized payloads, remote
-- tracking URLs, and high-volume social abuse. CHECK constraints are added
-- NOT VALID so existing legacy rows do not block deployment; PostgreSQL still
-- enforces them for every new or updated row.

begin;

create or replace function public.is_allowed_avatar_url(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value is null
    or value ~ '^https://qanfxjjiegqdmhmgwtxl[.]supabase[.]co/storage/v1/object/public/avatars/'
    or value ~ '^https://[a-z0-9-]+[.]googleusercontent[.]com/';
$$;

create or replace function public.is_allowed_route_photo_url(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value is not null
    and (
      value ~ '^https://qanfxjjiegqdmhmgwtxl[.]supabase[.]co/storage/v1/object/public/route-photos/'
      or value = 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D''http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg''%20width%3D''400''%20height%3D''300''%3E%3Crect%20width%3D''400''%20height%3D''300''%20fill%3D''%231b1e1c''%2F%3E%3Cpath%20d%3D''M110%20205%20L175%20125%20L215%20172%20L250%20140%20L300%20205%20Z''%20fill%3D''%232a2f2c''%2F%3E%3Ccircle%20cx%3D''250''%20cy%3D''95''%20r%3D''16''%20fill%3D''%232a2f2c''%2F%3E%3C%2Fsvg%3E'
    );
$$;

revoke all on function public.is_allowed_avatar_url(text) from public, anon;
revoke all on function public.is_allowed_route_photo_url(text) from public, anon;
grant execute on function public.is_allowed_avatar_url(text) to authenticated;
grant execute on function public.is_allowed_route_photo_url(text) to authenticated;

alter table public.profiles drop constraint if exists profiles_security_lengths;
alter table public.profiles add constraint profiles_security_lengths check (
  char_length(display_name) between 1 and 60
  and (username is null or char_length(username) between 3 and 20)
  and (bio is null or char_length(bio) <= 160)
  and (offgrid_gym_label is null or char_length(offgrid_gym_label) <= 120)
) not valid;

alter table public.profiles drop constraint if exists profiles_avatar_url_safe;
alter table public.profiles add constraint profiles_avatar_url_safe
  check (public.is_allowed_avatar_url(avatar_url)) not valid;

alter table public.gyms drop constraint if exists gyms_security_lengths;
alter table public.gyms add constraint gyms_security_lengths check (
  char_length(name) between 2 and 120
  and (address is null or char_length(address) <= 240)
  and (city is null or char_length(city) <= 120)
  and (state is null or char_length(state) <= 120)
  and (brand is null or char_length(brand) <= 120)
  and (country is null or char_length(country) <= 120)
  and (cc is null or char_length(cc) = 2)
) not valid;

alter table public.routes drop constraint if exists routes_security_lengths;
alter table public.routes add constraint routes_security_lengths check (
  char_length(hold_color) between 1 and 40
  and (name is null or char_length(name) <= 80)
  and (description is null or char_length(description) <= 500)
  and char_length(photo_url) <= 2048
  and (video_url is null or char_length(video_url) <= 2048)
) not valid;

alter table public.routes drop constraint if exists routes_photo_url_safe;
alter table public.routes add constraint routes_photo_url_safe
  check (public.is_allowed_route_photo_url(photo_url)) not valid;

alter table public.sends drop constraint if exists sends_security_lengths;
alter table public.sends add constraint sends_security_lengths check (
  (note is null or char_length(note) <= 500)
  and (photo_url is null or char_length(photo_url) <= 2048)
) not valid;

alter table public.sends drop constraint if exists sends_photo_url_safe;
alter table public.sends add constraint sends_photo_url_safe
  check (photo_url is null or public.is_allowed_route_photo_url(photo_url)) not valid;

alter table public.comments drop constraint if exists comments_body_length;
alter table public.comments add constraint comments_body_length
  check (char_length(body) between 1 and 2000) not valid;

alter table public.project_notes drop constraint if exists project_notes_body_length;
alter table public.project_notes add constraint project_notes_body_length
  check (char_length(body) <= 500) not valid;

alter table public.climb_shares drop constraint if exists climb_shares_message_length;
alter table public.climb_shares add constraint climb_shares_message_length
  check (message is null or char_length(message) <= 500) not valid;

alter table public.content_reports drop constraint if exists content_reports_note_length;
alter table public.content_reports add constraint content_reports_note_length
  check (note is null or char_length(note) <= 500) not valid;

alter table public.personal_logs drop constraint if exists personal_logs_security_lengths;
alter table public.personal_logs add constraint personal_logs_security_lengths check (
  (gym_label is null or char_length(gym_label) <= 120)
  and char_length(hold_color) between 1 and 40
  and (route_name is null or char_length(route_name) <= 80)
  and (note is null or char_length(note) <= 500)
  and (photo_url is null or char_length(photo_url) <= 2048)
) not valid;

alter table public.personal_logs drop constraint if exists personal_logs_photo_url_safe;
alter table public.personal_logs add constraint personal_logs_photo_url_safe
  check (photo_url is null or public.is_allowed_route_photo_url(photo_url)) not valid;

-- Uploads now pass through the authenticated upload-image Edge Function,
-- which validates file signatures and rate limits with the service role. Keep
-- owner deletion for cleanup/account deletion, but remove bypassable direct
-- client insert/update access.
drop policy if exists "route photos authenticated insert" on storage.objects;
drop policy if exists "route photos owner insert" on storage.objects;
drop policy if exists "route photos owner update" on storage.objects;
drop policy if exists "avatars auth upload" on storage.objects;
drop policy if exists "avatars auth update" on storage.objects;
drop policy if exists "avatars owner insert" on storage.objects;
drop policy if exists "avatars owner update" on storage.objects;

create table if not exists public.image_upload_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  image_kind text not null check (image_kind in ('route', 'avatar')),
  created_at timestamptz not null default now()
);

create index if not exists image_upload_events_user_time_idx
  on public.image_upload_events(user_id, image_kind, created_at desc);

alter table public.image_upload_events enable row level security;
revoke all on public.image_upload_events from public, anon, authenticated;

create or replace function public.register_image_upload(
  p_user_id uuid,
  p_image_kind text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_uploads integer;
  recent_uploads integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required';
  end if;
  if p_image_kind = 'route' then
    max_uploads := 60;
  elsif p_image_kind = 'avatar' then
    max_uploads := 20;
  else
    raise exception 'Invalid image kind';
  end if;

  -- Serialize checks for the same account so parallel requests cannot race
  -- through the hourly ceiling.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || ':' || p_image_kind, 0)
  );
  delete from public.image_upload_events
    where user_id = p_user_id
      and image_kind = p_image_kind
      and created_at < pg_catalog.now() - interval '24 hours';
  select count(*) into recent_uploads
    from public.image_upload_events
    where user_id = p_user_id
      and image_kind = p_image_kind
      and created_at >= pg_catalog.now() - interval '1 hour';
  if recent_uploads >= max_uploads then
    raise exception 'Too many uploads. Please wait and try again.'
      using errcode = 'P0001';
  end if;

  insert into public.image_upload_events(user_id, image_kind)
  values (p_user_id, p_image_kind);
end;
$$;

revoke all on function public.register_image_upload(uuid, text)
  from public, anon, authenticated;
grant execute on function public.register_image_upload(uuid, text)
  to service_role;

-- Keep the friends feed bounded even for accounts with hundreds of friends.
-- The per-friend cap preserves variety; the global cap prevents one response
-- from growing without limit.
create or replace function public.get_friend_activity(p_limit_per_friend integer default 6)
returns table(
  activity_kind text,
  activity_id uuid,
  activity_owner_id uuid,
  route_id uuid,
  send_type text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with viewer as (
    select auth.uid() as id
  ),
  friend_ids as (
    select case
      when f.requester_id = v.id then f.addressee_id
      else f.requester_id
    end as friend_id
    from public.friendships f
    cross join viewer v
    where f.status = 'accepted'
      and v.id is not null
      and (f.requester_id = v.id or f.addressee_id = v.id)
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = v.id and b.blocked_id = case when f.requester_id = v.id then f.addressee_id else f.requester_id end)
           or (b.blocked_id = v.id and b.blocker_id = case when f.requester_id = v.id then f.addressee_id else f.requester_id end)
      )
  ),
  activity as (
    select
      'send'::text as activity_kind,
      s.id as activity_id,
      s.user_id as activity_owner_id,
      s.route_id,
      s.send_type::text as send_type,
      s.created_at
    from public.sends s
    join friend_ids f on f.friend_id = s.user_id
    join public.profiles p on p.id = s.user_id
    where s.profile_visible and p.sends_public and s.send_type <> 'attempt'

    union all

    select
      'project'::text,
      b.id,
      b.user_id,
      b.route_id,
      null::text,
      b.created_at
    from public.bookmarks b
    join friend_ids f on f.friend_id = b.user_id
    join public.profiles p on p.id = b.user_id
    where b.kind = 'project' and b.profile_visible and p.projects_public
  ),
  ranked as (
    select a.*,
      row_number() over (
        partition by a.activity_owner_id
        order by a.created_at desc, a.activity_id
      ) as friend_rank
    from activity a
  )
  select
    r.activity_kind,
    r.activity_id,
    r.activity_owner_id,
    r.route_id,
    r.send_type,
    r.created_at
  from ranked r
  where r.friend_rank <= greatest(1, least(coalesce(p_limit_per_friend, 6), 12))
  order by r.created_at desc, r.activity_id
  limit 200;
$$;

revoke all on function public.get_friend_activity(integer) from public, anon;
grant execute on function public.get_friend_activity(integer) to authenticated;

-- Bound social writes per authenticated account. This supplements Supabase's
-- gateway/Auth protections with product-specific limits where RLS alone would
-- still permit spam. Server timestamps prevent a modified client from evading
-- the rolling windows by supplying an old created_at value.
create or replace function public.enforce_social_write_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  actor_column text;
  max_writes integer;
  window_size interval;
  recent_writes integer;
  supplied_actor uuid;
begin
  if current_user_id is null then
    return new;
  end if;

  case tg_table_name
    when 'friendships' then
      actor_column := 'requester_id'; max_writes := 30; window_size := interval '1 hour';
    when 'climb_shares' then
      actor_column := 'from_user'; max_writes := 60; window_size := interval '1 hour';
    when 'content_reports' then
      actor_column := 'reporter_id'; max_writes := 30; window_size := interval '1 day';
    when 'route_reports' then
      actor_column := 'user_id'; max_writes := 30; window_size := interval '1 day';
    when 'comments' then
      actor_column := 'user_id'; max_writes := 60; window_size := interval '1 hour';
    when 'activity_reactions' then
      actor_column := 'reactor_id'; max_writes := 120; window_size := interval '1 hour';
    else
      raise exception 'Unsupported rate-limited table';
  end case;

  supplied_actor := nullif(to_jsonb(new) ->> actor_column, '')::uuid;
  if supplied_actor is distinct from current_user_id then
    raise exception 'Authenticated user does not match write owner';
  end if;

  execute format(
    'select count(*) from public.%I where %I = $1 and created_at >= $2',
    tg_table_name,
    actor_column
  ) into recent_writes using current_user_id, statement_timestamp() - window_size;

  if recent_writes >= max_writes then
    raise exception 'Too many recent actions. Please wait and try again.'
      using errcode = 'P0001';
  end if;

  new.created_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function public.enforce_social_write_rate_limit()
  from public, anon, authenticated;

drop trigger if exists rate_limit_friendships on public.friendships;
create trigger rate_limit_friendships before insert on public.friendships
for each row execute function public.enforce_social_write_rate_limit();

drop trigger if exists rate_limit_climb_shares on public.climb_shares;
create trigger rate_limit_climb_shares before insert on public.climb_shares
for each row execute function public.enforce_social_write_rate_limit();

drop trigger if exists rate_limit_content_reports on public.content_reports;
create trigger rate_limit_content_reports before insert on public.content_reports
for each row execute function public.enforce_social_write_rate_limit();

drop trigger if exists rate_limit_route_reports on public.route_reports;
create trigger rate_limit_route_reports before insert on public.route_reports
for each row execute function public.enforce_social_write_rate_limit();

drop trigger if exists rate_limit_comments on public.comments;
create trigger rate_limit_comments before insert on public.comments
for each row execute function public.enforce_social_write_rate_limit();

drop trigger if exists rate_limit_activity_reactions on public.activity_reactions;
create trigger rate_limit_activity_reactions before insert on public.activity_reactions
for each row execute function public.enforce_social_write_rate_limit();

commit;
