-- Pro video library. Upload authorization and file validation happen in the
-- upload-video Edge Function; authenticated climbers may watch public clips.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'climb-videos',
  'climb-videos',
  false,
  52428800,
  array['video/mp4', 'video/quicktime']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.climb_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  route_id uuid not null references public.routes(id) on delete cascade,
  storage_path text not null,
  caption text,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, route_id)
);

alter table public.climb_videos drop constraint if exists climb_videos_security_lengths;
alter table public.climb_videos add constraint climb_videos_security_lengths check (
  char_length(storage_path) between 5 and 300
  and (caption is null or char_length(caption) <= 120)
) not valid;

create table if not exists public.pending_video_uploads (
  user_id uuid not null references auth.users(id) on delete cascade,
  route_id uuid not null references public.routes(id) on delete cascade,
  storage_path text primary key,
  caption text,
  expected_bytes bigint not null check (expected_bytes between 1 and 52428800),
  expected_mime text not null check (expected_mime in ('video/mp4', 'video/quicktime')),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  created_at timestamptz not null default now()
);
alter table public.pending_video_uploads enable row level security;
revoke all on public.pending_video_uploads from public, anon, authenticated;

create index if not exists climb_videos_recent_idx
  on public.climb_videos(created_at desc);
create index if not exists climb_videos_owner_idx
  on public.climb_videos(user_id, created_at desc);

create table if not exists public.climb_video_reports (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.climb_videos(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('spam', 'inappropriate', 'harassment', 'wrong_info', 'other')),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (video_id, reporter_id)
);
create index if not exists climb_video_reports_recent_idx
  on public.climb_video_reports(reporter_id, created_at desc);
alter table public.climb_video_reports enable row level security;
revoke all on public.climb_video_reports from public, anon, authenticated;

drop policy if exists climb_video_reports_own_select on public.climb_video_reports;
create policy climb_video_reports_own_select on public.climb_video_reports
for select to authenticated using (reporter_id = auth.uid());

alter table public.climb_videos enable row level security;

drop policy if exists climb_videos_select on public.climb_videos;
create policy climb_videos_select on public.climb_videos
for select to authenticated
using (
  user_id = auth.uid()
  or (
    visibility = 'public'
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = climb_videos.user_id)
         or (b.blocked_id = auth.uid() and b.blocker_id = climb_videos.user_id)
    )
  )
);

-- Metadata is inserted only by the validated Edge Function. Owners can remove
-- their metadata; the client deletes the matching Storage object first.
drop policy if exists climb_videos_insert on public.climb_videos;
drop policy if exists climb_videos_update on public.climb_videos;
drop policy if exists climb_videos_delete on public.climb_videos;
create policy climb_videos_delete on public.climb_videos
for delete to authenticated using (user_id = auth.uid());

create table if not exists public.video_upload_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists video_upload_events_user_time_idx
  on public.video_upload_events(user_id, created_at desc);
alter table public.video_upload_events enable row level security;
revoke all on public.video_upload_events from public, anon, authenticated;

create or replace function public.register_video_upload(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_uploads integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || ':video', 0)
  );
  delete from public.video_upload_events
  where user_id = p_user_id
    and created_at < pg_catalog.now() - interval '24 hours';
  select count(*) into recent_uploads
  from public.video_upload_events
  where user_id = p_user_id
    and created_at >= pg_catalog.now() - interval '1 hour';
  if recent_uploads >= 12 then
    raise exception 'Too many video uploads. Please wait and try again.'
      using errcode = 'P0001';
  end if;
  insert into public.video_upload_events(user_id) values (p_user_id);
end;
$$;

revoke all on function public.register_video_upload(uuid)
  from public, anon, authenticated;
grant execute on function public.register_video_upload(uuid) to service_role;

create or replace function public.report_climb_video(
  p_video_id uuid,
  p_reason text,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  owner_id uuid;
  report_total integer;
  recent_reports integer;
begin
  if current_user_id is null then
    raise exception 'Sign in required';
  end if;
  if p_reason not in ('spam', 'inappropriate', 'harassment', 'wrong_info', 'other') then
    raise exception 'Invalid report reason';
  end if;
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'Report details are too long';
  end if;

  select user_id into owner_id
  from public.climb_videos
  where id = p_video_id;
  if owner_id is null then
    raise exception 'Video not found';
  end if;
  if owner_id = current_user_id then
    raise exception 'You cannot report your own video';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text || ':video-report', 0)
  );
  select count(*) into recent_reports
  from public.climb_video_reports
  where reporter_id = current_user_id
    and created_at >= pg_catalog.now() - interval '1 day';
  if recent_reports >= 30 then
    raise exception 'Too many reports. Please wait and try again.';
  end if;

  insert into public.climb_video_reports(video_id, reporter_id, reason, note)
  values (p_video_id, current_user_id, p_reason, nullif(btrim(p_note), ''))
  on conflict (video_id, reporter_id) do update
    set reason = excluded.reason,
        note = excluded.note,
        created_at = pg_catalog.now();

  select count(*) into report_total
  from public.climb_video_reports
  where video_id = p_video_id;

  if report_total >= 3 then
    update public.climb_videos
    set visibility = 'private', updated_at = pg_catalog.now()
    where id = p_video_id;
  end if;
  return report_total;
end;
$$;

revoke all on function public.report_climb_video(uuid, text, text)
  from public, anon;
grant execute on function public.report_climb_video(uuid, text, text)
  to authenticated;

-- The bucket is private. Uploads use short-lived signed upload tokens issued
-- only after the Edge Function verifies Pro access, file limits and ownership.
-- Owners retain delete access for failed-upload cleanup and removal.
drop policy if exists "climb videos authenticated insert" on storage.objects;
drop policy if exists "climb videos owner insert" on storage.objects;
drop policy if exists "climb videos owner update" on storage.objects;
drop policy if exists "climb videos owner delete" on storage.objects;
create policy "climb videos owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'climb-videos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
drop policy if exists "climb videos owner select" on storage.objects;
create policy "climb videos owner select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'climb-videos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
drop policy if exists "climb videos community select" on storage.objects;
create policy "climb videos community select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'climb-videos'
    and exists (
      select 1 from public.climb_videos cv
      where cv.storage_path = storage.objects.name
        and cv.visibility = 'public'
        and not exists (
          select 1 from public.blocks b
          where (b.blocker_id = auth.uid() and b.blocked_id = cv.user_id)
             or (b.blocked_id = auth.uid() and b.blocker_id = cv.user_id)
        )
    )
  );

commit;
