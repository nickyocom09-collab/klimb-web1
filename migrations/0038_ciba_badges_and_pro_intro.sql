-- Add CIBA Climbing, keep special profile badges admin-controlled, and make
-- the free-first Pro introduction durable across a user's devices.

begin;

-- CIBA's official location page lists this Sierra Vista address. Reuse an
-- existing row when one was previously community-added instead of creating a
-- second gym.
update public.gyms
set name = 'CIBA Climbing Gym',
    address = '4066 E Monsanto Dr, Suite B, Sierra Vista, AZ 85650',
    city = 'Sierra Vista',
    state = 'AZ',
    country = 'United States',
    cc = 'us',
    brand = 'CIBA Climbing',
    status = 'approved',
    grading_style = 'classic'
where lower(coalesce(city, '')) = 'sierra vista'
  and regexp_replace(lower(name), '[^a-z0-9]+', '', 'g') in
      ('ciba', 'cibaclimbing', 'cibaclimbinggym');

insert into public.gyms (
  name, address, city, state, country, cc, brand, status, grading_style
)
select
  'CIBA Climbing Gym',
  '4066 E Monsanto Dr, Suite B, Sierra Vista, AZ 85650',
  'Sierra Vista', 'AZ', 'United States', 'us', 'CIBA Climbing',
  'approved', 'classic'
where not exists (
  select 1
  from public.gyms
  where lower(coalesce(city, '')) = 'sierra vista'
    and regexp_replace(lower(name), '[^a-z0-9]+', '', 'g') in
        ('ciba', 'cibaclimbing', 'cibaclimbinggym')
);

-- If multiple community copies existed, preserve every reference and keep one
-- canonical approved record.
create temporary table ciba_duplicate_map on commit drop as
with ranked as (
  select id,
    first_value(id) over (
      order by (status = 'approved') desc, (address is not null) desc, id
    ) as canonical_id
  from public.gyms
  where lower(coalesce(city, '')) = 'sierra vista'
    and regexp_replace(lower(name), '[^a-z0-9]+', '', 'g') =
        'cibaclimbinggym'
)
select id as duplicate_id, canonical_id
from ranked
where id <> canonical_id;

insert into public.gym_unlocks (user_id, gym_id, unlocked_at)
select gu.user_id, m.canonical_id, min(gu.unlocked_at)
from public.gym_unlocks gu
join ciba_duplicate_map m on m.duplicate_id = gu.gym_id
group by gu.user_id, m.canonical_id
on conflict (user_id, gym_id) do update
set unlocked_at = least(public.gym_unlocks.unlocked_at, excluded.unlocked_at);

delete from public.gym_unlocks gu
using ciba_duplicate_map m
where gu.gym_id = m.duplicate_id;

do $$
declare ref record;
begin
  for ref in
    select ns.nspname as schema_name, cl.relname as table_name,
           a.attname as column_name
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
      'update %I.%I t set %I = m.canonical_id from ciba_duplicate_map m where t.%I = m.duplicate_id',
      ref.schema_name, ref.table_name, ref.column_name, ref.column_name
    );
  end loop;
end $$;

delete from public.gyms g
using ciba_duplicate_map m
where g.id = m.duplicate_id;

-- Special community titles live outside profiles so users cannot award or
-- edit their own badge. New accounts receive no row and therefore no badge.
create table if not exists public.profile_badges (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  badge_key text not null check (badge_key in ('slab_king')),
  label text not null check (char_length(label) between 1 and 30),
  awarded_at timestamptz not null default now()
);

alter table public.profile_badges enable row level security;

drop policy if exists "Signed-in users can view profile badges"
  on public.profile_badges;
create policy "Signed-in users can view profile badges"
on public.profile_badges for select
to authenticated
using (true);

revoke all on public.profile_badges from anon, authenticated;
grant select on public.profile_badges to authenticated;

insert into public.profile_badges (user_id, badge_key, label)
select id, 'slab_king', 'Slab King'
from public.profiles
where lower(username) = 'willpower'
on conflict (user_id) do update
set badge_key = excluded.badge_key,
    label = excluded.label;

-- This timestamp only controls the optional welcome card. It grants no access
-- and is safe for a profile owner to update through the existing profile RLS.
alter table public.profiles
  add column if not exists pro_intro_seen_at timestamptz;

-- Explicitly preserve the free-first entitlement defaults. Founding/lifetime
-- users keep their existing rows; every ordinary new row starts free and
-- inactive until Apple's verified transaction endpoint promotes it.
alter table public.user_entitlements
  alter column plan set default 'free',
  alter column entitlement_type set default 'free',
  alter column entitlement_status set default 'inactive',
  alter column is_lifetime_pro set default false;

commit;
