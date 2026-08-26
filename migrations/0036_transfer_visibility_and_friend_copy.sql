-- Preserve a climber's profile-post choice when an off-grid climb is later
-- transferred into an approved gym, and use Klimb's intended friend-request
-- wording. Safe to run after 0035.

begin;

alter table public.personal_logs
  add column if not exists profile_visible boolean not null default true;

create or replace function public.transfer_personal_log(
  p_personal_log_id uuid,
  p_gym_id uuid
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_pl public.personal_logs%rowtype;
  v_route_id uuid;
  v_note text;
  v_name text;
  v_photo text;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to transfer a climb.';
  end if;

  select * into v_pl
  from public.personal_logs
  where id = p_personal_log_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Off-grid climb not found.';
  end if;
  if v_pl.transferred_at is not null then
    raise exception 'This climb was already transferred.';
  end if;
  if not exists (
    select 1 from public.gyms where id = p_gym_id and status = 'approved'
  ) then
    raise exception 'That gym is not available yet.';
  end if;

  v_note := nullif(btrim(coalesce(v_pl.note, '')), '');
  v_name := nullif(btrim(coalesce(v_pl.route_name, '')), '');
  v_photo := coalesce(
    v_pl.photo_url,
    $ph$data:image/svg+xml;utf8,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'400'%20height%3D'300'%3E%3Crect%20width%3D'400'%20height%3D'300'%20fill%3D'%231b1e1c'%2F%3E%3Cpath%20d%3D'M110%20205%20L175%20125%20L215%20172%20L250%20140%20L300%20205%20Z'%20fill%3D'%232a2f2c'%2F%3E%3Ccircle%20cx%3D'250'%20cy%3D'95'%20r%3D'16'%20fill%3D'%232a2f2c'%2F%3E%3C%2Fsvg%3E$ph$
  );

  insert into public.routes (
    gym_id, photo_url, hold_color, climbing_type, gym_grade, name,
    created_by, created_at, last_activity_at
  ) values (
    p_gym_id, v_photo, v_pl.hold_color, v_pl.climbing_type, v_pl.gym_grade,
    v_name, v_user_id, v_pl.created_at, v_pl.created_at
  ) returning id into v_route_id;

  if v_pl.felt_grade is not null then
    insert into public.grades (route_id, user_id, grade, created_at, updated_at)
    values (v_route_id, v_user_id, v_pl.felt_grade, v_pl.created_at, v_pl.created_at);
  end if;

  if v_pl.stars is not null then
    insert into public.route_ratings (route_id, user_id, stars, created_at, updated_at)
    values (v_route_id, v_user_id, v_pl.stars, v_pl.created_at, v_pl.created_at);
  end if;

  if v_pl.outcome = 'project' then
    insert into public.bookmarks (user_id, route_id, kind, profile_visible, created_at)
    values (v_user_id, v_route_id, 'project', v_pl.profile_visible, v_pl.created_at);

    if v_note is not null then
      insert into public.project_notes (user_id, route_id, body, created_at, updated_at)
      values (v_user_id, v_route_id, v_note, v_pl.created_at, v_pl.created_at);
    end if;
  else
    insert into public.sends (
      route_id, user_id, send_type, attempts, note, profile_visible, created_at
    ) values (
      v_route_id, v_user_id, v_pl.outcome, 1, v_note,
      v_pl.profile_visible, v_pl.created_at
    );
  end if;

  update public.personal_logs
  set transferred_at = statement_timestamp(), transferred_route_id = v_route_id
  where id = v_pl.id;

  return v_route_id;
end;
$$;

revoke all on function public.transfer_personal_log(uuid, uuid) from public, anon;
grant execute on function public.transfer_personal_log(uuid, uuid) to authenticated;

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
      'New Klimb request',
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
      'Klimb request accepted',
      'You and ' || coalesce(v_name, 'a climber') || ' are now friends.',
      '/u/' || new.addressee_id::text,
      jsonb_build_object('friendship_id', new.id, 'actor_id', new.addressee_id),
      'friend-accept:' || new.id::text
    ) on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

update public.push_events
set title = 'New Klimb request',
    body = coalesce(nullif(p.display_name, ''), 'A climber') || ' wants to Klimb with you.'
from public.profiles p
where public.push_events.processed_at is null
  and public.push_events.kind = 'friend_request'
  and (public.push_events.data ->> 'actor_id') = p.id::text;

revoke all on function public.queue_friendship_push()
  from public, anon, authenticated;

commit;
