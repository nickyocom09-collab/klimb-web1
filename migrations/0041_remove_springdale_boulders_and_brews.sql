-- Remove the incorrect Springdale Boulders & Brews directory row while
-- preserving the real Fayetteville location and all user data linked to it.

begin;

insert into public.gyms (
  name, address, city, state, country, cc, brand, latitude, longitude,
  status, grading_style
)
select
  'Boulders & Brews', '612 W Dickson St, Fayetteville, AR 72701',
  'Fayetteville', 'AR', 'United States', 'us', 'Boulders & Brews',
  36.0672597, -94.1671444, 'approved', 'brew_bands'
where not exists (
  select 1
  from public.gyms
  where city ilike 'Fayetteville'
    and (
      lower(name) ~ 'boulders?.*brews?'
      or lower(coalesce(brand, '')) ~ 'boulders?.*brews?'
    )
);

create temporary table springdale_brews_map on commit drop as
with canonical as (
  select id
  from public.gyms
  where city ilike 'Fayetteville'
    and (
      lower(name) ~ 'boulders?.*brews?'
      or lower(coalesce(brand, '')) ~ 'boulders?.*brews?'
    )
  order by (status = 'approved') desc, id
  limit 1
)
select g.id as duplicate_id, canonical.id as canonical_id
from public.gyms g
cross join canonical
where g.city ilike 'Springdale'
  and (
    lower(g.name) ~ 'boulders?.*brews?'
    or lower(coalesce(g.brand, '')) ~ 'boulders?.*brews?'
  );

insert into public.gym_unlocks (user_id, gym_id, unlocked_at)
select gu.user_id, m.canonical_id, min(gu.unlocked_at)
from public.gym_unlocks gu
join springdale_brews_map m on m.duplicate_id = gu.gym_id
group by gu.user_id, m.canonical_id
on conflict (user_id, gym_id) do update
set unlocked_at = least(public.gym_unlocks.unlocked_at, excluded.unlocked_at);

delete from public.gym_unlocks gu
using springdale_brews_map m
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
      'update %I.%I t set %I = m.canonical_id from springdale_brews_map m where t.%I = m.duplicate_id',
      ref.schema_name, ref.table_name, ref.column_name, ref.column_name
    );
  end loop;
end $$;

delete from public.gyms g
using springdale_brews_map m
where g.id = m.duplicate_id;

commit;
