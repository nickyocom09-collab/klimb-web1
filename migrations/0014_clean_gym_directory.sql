-- Klimb gym directory cleanup and requested additions.
--
-- Imported sources do not always supply a city. The app now shows a useful
-- state/country fallback, while this migration safely merges only listings at
-- the same physical location (or the same no-coordinate address).

begin;

-- Trim accidental whitespace before comparing or displaying directory data.
update public.gyms
set
  name = btrim(name),
  city = nullif(btrim(city), ''),
  state = nullif(btrim(state), ''),
  country = nullif(btrim(country), ''),
  brand = nullif(btrim(brand), '');

-- Point every existing route/profile at the best copy before deleting a true
-- duplicate. Branches with the same name remain distinct unless they share
-- the same coordinates (rounded to roughly 110 m) or address data.
create temporary table gym_duplicate_map on commit drop as
with prepared as (
  select
    id,
    lower(regexp_replace(name, '[^a-z0-9]+', '', 'g')) as normalized_name,
    case
      when latitude is not null and longitude is not null then
        'coordinates:' || round(latitude::numeric, 3)::text || ':' || round(longitude::numeric, 3)::text
      else
        'address:' || lower(coalesce(city, '')) || ':' || lower(coalesce(state, '')) || ':' || lower(coalesce(country, ''))
    end as location_key,
    city,
    state,
    country,
    latitude,
    longitude
  from public.gyms
  where btrim(name) <> ''
), ranked as (
  select
    id,
    first_value(id) over (
      partition by normalized_name, location_key
      order by
        (city is not null)::int + (state is not null)::int + (country is not null)::int +
        (latitude is not null)::int + (longitude is not null)::int desc,
        id
    ) as canonical_id
  from prepared
)
select id as duplicate_id, canonical_id
from ranked
where id <> canonical_id;

update public.routes r
set gym_id = d.canonical_id
from gym_duplicate_map d
where r.gym_id = d.duplicate_id;

update public.profiles p
set
  home_gym_id = coalesce((select canonical_id from gym_duplicate_map where duplicate_id = p.home_gym_id), p.home_gym_id),
  visiting_gym_id = coalesce((select canonical_id from gym_duplicate_map where duplicate_id = p.visiting_gym_id), p.visiting_gym_id)
where p.home_gym_id in (select duplicate_id from gym_duplicate_map)
   or p.visiting_gym_id in (select duplicate_id from gym_duplicate_map);

-- The legacy users table may still be present in older projects.
do $$
begin
  if to_regclass('public.users') is not null then
    execute $sql$
      update public.users u
      set home_gym_id = coalesce(
        (select canonical_id from gym_duplicate_map where duplicate_id = u.home_gym_id),
        u.home_gym_id
      )
      where u.home_gym_id in (select duplicate_id from gym_duplicate_map)
    $sql$;
  end if;
end $$;

delete from public.gyms g
using gym_duplicate_map d
where g.id = d.duplicate_id;

-- Exact requested gym locations, verified against their official location
-- pages. The BLOC may already be present from the OSM import; in that case it
-- is refreshed rather than duplicated.
with incoming (name, city, state, country, cc, brand, latitude, longitude) as (
  values
    ('Rocks & Ropes', 'Tucson', 'Arizona', 'United States', 'us', 'Rocks & Ropes', 32.2176635, -110.9614977),
    ('The BLOC climbing + fitness', 'Tucson', 'Arizona', 'United States', 'us', 'Rocks & Ropes', 32.2600889, -110.8005906),
    ('Rock Solid Climbing', 'Tucson', 'Arizona', 'United States', 'us', 'Rock Solid', 32.3287945, -111.0486842),
    ('The Climbing Hangar Liverpool North', 'Liverpool', 'England', 'United Kingdom', 'gb', 'The Climbing Hangar', 53.4319306, -2.9915826),
    ('The Climbing Hangar Liverpool South', 'Liverpool', 'England', 'United Kingdom', 'gb', 'The Climbing Hangar', 53.3497914, -2.8863946),
    ('Awesome Walls Liverpool', 'Liverpool', 'England', 'United Kingdom', 'gb', 'Awesome Walls', 53.4239270, -2.9957640),
    ('Hangar 18 Orange', 'Orange', 'California', 'United States', 'us', 'Hangar 18', 33.8061382, -117.8696704)
), updated as (
  update public.gyms g
  set
    city = i.city,
    state = i.state,
    country = i.country,
    cc = i.cc,
    brand = i.brand,
    latitude = i.latitude,
    longitude = i.longitude,
    status = 'approved',
    grading_style = 'classic'
  from incoming i
  where lower(regexp_replace(g.name, '[^a-z0-9]+', '', 'g')) = lower(regexp_replace(i.name, '[^a-z0-9]+', '', 'g'))
    and g.latitude is not null
    and g.longitude is not null
    and abs(g.latitude - i.latitude) < 0.0015
    and abs(g.longitude - i.longitude) < 0.0015
  returning g.id
)
insert into public.gyms (
  name, city, state, country, cc, brand, latitude, longitude, status, grading_style
)
select
  i.name, i.city, i.state, i.country, i.cc, i.brand,
  i.latitude, i.longitude, 'approved', 'classic'
from incoming i
where not exists (
  select 1
  from public.gyms g
  where lower(regexp_replace(g.name, '[^a-z0-9]+', '', 'g')) = lower(regexp_replace(i.name, '[^a-z0-9]+', '', 'g'))
    and g.latitude is not null
    and g.longitude is not null
    and abs(g.latitude - i.latitude) < 0.0015
    and abs(g.longitude - i.longitude) < 0.0015
);

commit;
