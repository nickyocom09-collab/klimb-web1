-- Build 69 follow-up: logging-time Pro video, durable reactions, and the
-- authoritative Boulders & Brews directory entry.

begin;

alter table public.logbook_preferences
  add column if not exists show_video boolean not null default true;

update storage.buckets
set file_size_limit = 262144000,
    allowed_mime_types = array['video/mp4', 'video/quicktime', 'video/x-m4v']
where id = 'climb-videos';

alter table public.pending_video_uploads
  drop constraint if exists pending_video_uploads_expected_bytes_check;
alter table public.pending_video_uploads
  add constraint pending_video_uploads_expected_bytes_check
  check (expected_bytes between 1 and 262144000) not valid;
alter table public.pending_video_uploads
  drop constraint if exists pending_video_uploads_expected_mime_check;
alter table public.pending_video_uploads
  add constraint pending_video_uploads_expected_mime_check
  check (expected_mime in ('video/mp4', 'video/quicktime', 'video/x-m4v')) not valid;

-- This screen is now a personal library, not a community feed.
drop policy if exists climb_videos_select on public.climb_videos;
create policy climb_videos_select on public.climb_videos
for select to authenticated using (user_id = auth.uid());
drop policy if exists "climb videos community select" on storage.objects;

-- Changing an emoji must not look like a brand-new reaction notification.
create or replace function public.keep_reaction_created_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists keep_reaction_created_at on public.activity_reactions;
create trigger keep_reaction_created_at
before update on public.activity_reactions
for each row execute function public.keep_reaction_created_at();

-- Keep one real Boulders & Brews in Fayetteville. Repoint every existing gym
-- foreign key before removing mistaken Springdale/duplicate directory rows.
insert into public.gyms (
  name, address, city, state, country, cc, brand, latitude, longitude,
  status, grading_style
)
select
  'Boulders & Brews', '612 W Dickson St, Fayetteville, AR 72701',
  'Fayetteville', 'AR', 'United States', 'us', 'Boulders & Brews',
  36.0672597, -94.1671444, 'approved', 'brew_bands'
where not exists (
  select 1 from public.gyms
  where city ilike 'Fayetteville' and lower(name) ~ 'boulders?.*brews?'
);

create temporary table brews_duplicate_map on commit drop as
with canonical as (
  select id
  from public.gyms
  where city ilike 'Fayetteville' and lower(name) ~ 'boulders?.*brews?'
  order by (status = 'approved') desc, id
  limit 1
)
select g.id as duplicate_id, canonical.id as canonical_id
from public.gyms g cross join canonical
where lower(g.name) ~ 'boulders?.*brews?'
  and (
    g.city ilike 'Fayetteville'
    or g.city ilike 'Springdale'
    or upper(coalesce(g.state, '')) = 'AR'
    or lower(coalesce(g.state, '')) = 'arkansas'
  )
  and g.id <> canonical.id;

update public.gyms
set name = 'Boulders & Brews',
    address = '612 W Dickson St, Fayetteville, AR 72701',
    city = 'Fayetteville', state = 'AR', country = 'United States', cc = 'us',
    brand = 'Boulders & Brews', latitude = 36.0672597, longitude = -94.1671444,
    status = 'approved', grading_style = 'brew_bands'
where id = (select canonical_id from brews_duplicate_map limit 1)
   or (
     city ilike 'Fayetteville'
     and lower(name) ~ 'boulders?.*brews?'
     and not exists (select 1 from brews_duplicate_map)
   );

insert into public.gym_unlocks (user_id, gym_id, unlocked_at)
select gu.user_id, m.canonical_id, min(gu.unlocked_at)
from public.gym_unlocks gu
join brews_duplicate_map m on m.duplicate_id = gu.gym_id
group by gu.user_id, m.canonical_id
on conflict (user_id, gym_id) do update
set unlocked_at = least(public.gym_unlocks.unlocked_at, excluded.unlocked_at);

delete from public.gym_unlocks gu
using brews_duplicate_map m
where gu.gym_id = m.duplicate_id;

do $$
declare ref record;
begin
  for ref in
    select ns.nspname as schema_name, cl.relname as table_name, a.attname as column_name
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_namespace ns on ns.oid = cl.relnamespace
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'public.gyms'::regclass
      and array_length(c.conkey, 1) = 1
      and not (ns.nspname = 'public' and cl.relname = 'gym_unlocks')
  loop
    execute format(
      'update %I.%I t set %I = m.canonical_id from brews_duplicate_map m where t.%I = m.duplicate_id',
      ref.schema_name, ref.table_name, ref.column_name, ref.column_name
    );
  end loop;
end $$;

delete from public.gyms g
using brews_duplicate_map m
where g.id = m.duplicate_id;

commit;
