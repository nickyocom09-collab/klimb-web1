-- Off-grid logging: log climbs into a personal, gym-less logbook and transfer
-- them into a real gym once it's added to Klimb. Mirrors log_climb's columns so
-- a transfer is a 1:1 mapping. Personal logs are private (never in any gym feed
-- or community grade) until transferred.
--
-- Applied to the live project (qanfxjjiegqdmhmgwtxl) via Supabase apply_migration.

-- 1) Flag on profiles: non-null => user deliberately chose off-grid mode; value
--    is the free-text gym name they're waiting on. Lets the app stop bouncing a
--    gym-less user to the picker, and prefills the suggest/transfer copy.
alter table public.profiles
  add column if not exists offgrid_gym_label text;

-- 2) The gym-less climb store. Columns mirror what log_climb writes.
create table if not exists public.personal_logs (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  gym_label            text,
  pending_gym_id       uuid references public.gyms(id) on delete set null,
  climbing_type        public.climbing_type not null,
  hold_color           text not null,
  route_name           text,
  gym_grade            integer,
  felt_grade           integer,
  outcome              text not null check (outcome in ('flash', 'send', 'project')),
  stars                integer check (stars is null or (stars between 1 and 5)),
  note                 text,
  photo_url            text,
  created_at           timestamptz not null default now(),
  transferred_at       timestamptz,
  transferred_route_id uuid references public.routes(id) on delete set null
);

create index if not exists personal_logs_user_idx
  on public.personal_logs (user_id, created_at desc);

-- 3) RLS: a user can only see and touch their own rows. Nothing here is ever
--    exposed to anyone else.
alter table public.personal_logs enable row level security;

drop policy if exists personal_logs_select on public.personal_logs;
create policy personal_logs_select on public.personal_logs
  for select using (auth.uid() = user_id);

drop policy if exists personal_logs_insert on public.personal_logs;
create policy personal_logs_insert on public.personal_logs
  for insert with check (auth.uid() = user_id);

drop policy if exists personal_logs_update on public.personal_logs;
create policy personal_logs_update on public.personal_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists personal_logs_delete on public.personal_logs;
create policy personal_logs_delete on public.personal_logs
  for delete using (auth.uid() = user_id);

-- 4) Transfer one off-grid climb into a real gym, preserving its original date.
--    Reuses log_climb's exact shape (route + grade + rating + send/project note)
--    but stamps every child row's created_at with the personal log's date, and
--    skips the proximity check (this is historical data, not a live check-in).
--    Runs as one transaction per climb: a failure rolls back only that climb.
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
  -- routes.photo_url is NOT NULL; the client always stores a photo (real or the
  -- dark placeholder), but fall back defensively so a transfer never fails.
  v_photo := coalesce(
    v_pl.photo_url,
    $ph$data:image/svg+xml;utf8,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'400'%20height%3D'300'%3E%3Crect%20width%3D'400'%20height%3D'300'%20fill%3D'%231b1e1c'%2F%3E%3Cpath%20d%3D'M110%20205%20L175%20125%20L215%20172%20L250%20140%20L300%20205%20Z'%20fill%3D'%232a2f2c'%2F%3E%3Ccircle%20cx%3D'250'%20cy%3D'95'%20r%3D'16'%20fill%3D'%232a2f2c'%2F%3E%3C%2Fsvg%3E$ph$
  );

  insert into public.routes (
    gym_id, photo_url, hold_color, climbing_type, gym_grade, name,
    created_by, created_at, last_activity_at
  )
  values (
    p_gym_id, v_photo, v_pl.hold_color, v_pl.climbing_type, v_pl.gym_grade,
    v_name, v_user_id, v_pl.created_at, v_pl.created_at
  )
  returning id into v_route_id;

  if v_pl.felt_grade is not null then
    insert into public.grades (route_id, user_id, grade, created_at, updated_at)
    values (v_route_id, v_user_id, v_pl.felt_grade, v_pl.created_at, v_pl.created_at);
  end if;

  if v_pl.stars is not null then
    insert into public.route_ratings (route_id, user_id, stars, created_at, updated_at)
    values (v_route_id, v_user_id, v_pl.stars, v_pl.created_at, v_pl.created_at);
  end if;

  if v_pl.outcome = 'project' then
    insert into public.bookmarks (user_id, route_id, kind, created_at)
    values (v_user_id, v_route_id, 'project', v_pl.created_at);

    if v_note is not null then
      insert into public.project_notes (user_id, route_id, body, created_at, updated_at)
      values (v_user_id, v_route_id, v_note, v_pl.created_at, v_pl.created_at);
    end if;
  else
    insert into public.sends (route_id, user_id, send_type, attempts, note, created_at)
    values (v_route_id, v_user_id, v_pl.outcome, 1, v_note, v_pl.created_at);
  end if;

  update public.personal_logs
  set transferred_at = now(), transferred_route_id = v_route_id
  where id = v_pl.id;

  return v_route_id;
end;
$$;

revoke all on function public.transfer_personal_log(uuid, uuid) from public;
grant execute on function public.transfer_personal_log(uuid, uuid) to authenticated;
