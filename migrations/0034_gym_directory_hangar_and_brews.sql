-- Normalize the directory, add the requested Hangar locations, and keep every
-- existing route/profile pointed at the surviving gym when duplicates merge.

begin;

alter table public.gyms drop constraint if exists gyms_grading_style_check;
alter table public.gyms add constraint gyms_grading_style_check
  check (grading_style in ('classic', 'bands', 'brew_bands'));

-- The UI and search use postal abbreviations for US states. Imported rows have
-- historically contained both full names and codes, which split one state into
-- duplicate navigation sections.
update public.gyms
set state = case lower(btrim(state))
  when 'alabama' then 'AL' when 'al' then 'AL'
  when 'alaska' then 'AK' when 'ak' then 'AK'
  when 'arizona' then 'AZ' when 'az' then 'AZ'
  when 'arkansas' then 'AR' when 'ar' then 'AR'
  when 'california' then 'CA' when 'ca' then 'CA'
  when 'colorado' then 'CO' when 'co' then 'CO'
  when 'connecticut' then 'CT' when 'ct' then 'CT'
  when 'delaware' then 'DE' when 'de' then 'DE'
  when 'district of columbia' then 'DC' when 'dc' then 'DC'
  when 'florida' then 'FL' when 'fl' then 'FL'
  when 'georgia' then 'GA' when 'ga' then 'GA'
  when 'hawaii' then 'HI' when 'hi' then 'HI'
  when 'idaho' then 'ID' when 'id' then 'ID'
  when 'illinois' then 'IL' when 'il' then 'IL'
  when 'indiana' then 'IN' when 'in' then 'IN'
  when 'iowa' then 'IA' when 'ia' then 'IA'
  when 'kansas' then 'KS' when 'ks' then 'KS'
  when 'kentucky' then 'KY' when 'ky' then 'KY'
  when 'louisiana' then 'LA' when 'la' then 'LA'
  when 'maine' then 'ME' when 'me' then 'ME'
  when 'maryland' then 'MD' when 'md' then 'MD'
  when 'massachusetts' then 'MA' when 'ma' then 'MA'
  when 'michigan' then 'MI' when 'mi' then 'MI'
  when 'minnesota' then 'MN' when 'mn' then 'MN'
  when 'mississippi' then 'MS' when 'ms' then 'MS'
  when 'missouri' then 'MO' when 'mo' then 'MO'
  when 'montana' then 'MT' when 'mt' then 'MT'
  when 'nebraska' then 'NE' when 'ne' then 'NE'
  when 'nevada' then 'NV' when 'nv' then 'NV'
  when 'new hampshire' then 'NH' when 'nh' then 'NH'
  when 'new jersey' then 'NJ' when 'nj' then 'NJ'
  when 'new mexico' then 'NM' when 'nm' then 'NM'
  when 'new york' then 'NY' when 'ny' then 'NY'
  when 'north carolina' then 'NC' when 'nc' then 'NC'
  when 'north dakota' then 'ND' when 'nd' then 'ND'
  when 'ohio' then 'OH' when 'oh' then 'OH'
  when 'oklahoma' then 'OK' when 'ok' then 'OK'
  when 'oregon' then 'OR' when 'or' then 'OR'
  when 'pennsylvania' then 'PA' when 'pa' then 'PA'
  when 'rhode island' then 'RI' when 'ri' then 'RI'
  when 'south carolina' then 'SC' when 'sc' then 'SC'
  when 'south dakota' then 'SD' when 'sd' then 'SD'
  when 'tennessee' then 'TN' when 'tn' then 'TN'
  when 'texas' then 'TX' when 'tx' then 'TX'
  when 'utah' then 'UT' when 'ut' then 'UT'
  when 'vermont' then 'VT' when 'vt' then 'VT'
  when 'virginia' then 'VA' when 'va' then 'VA'
  when 'washington' then 'WA' when 'wa' then 'WA'
  when 'west virginia' then 'WV' when 'wv' then 'WV'
  when 'wisconsin' then 'WI' when 'wi' then 'WI'
  when 'wyoming' then 'WY' when 'wy' then 'WY'
  else btrim(state)
end,
cc = 'us',
country = 'United States'
where (
    lower(coalesce(cc, '')) = 'us'
    or lower(coalesce(country, '')) in ('united states', 'united states of america', 'usa')
  )
  and city is not null;

create temporary table requested_gyms (
  name text, address text, city text, state text, country text, cc text,
  brand text, latitude double precision, longitude double precision,
  grading_style text
) on commit drop;

insert into requested_gyms values
  ('Hangar 18 Arcadia', '305 N Santa Anita Ave, Arcadia, CA 91006', 'Arcadia', 'CA', 'United States', 'us', 'Hangar 18', 34.1431523, -118.0315906, 'classic'),
  ('Hangar 18 East Riverside', '2111 Iowa Ave Unit A, Riverside, CA 92507', 'Riverside', 'CA', 'United States', 'us', 'Hangar 18', 33.9916619, -117.3407811, 'classic'),
  ('Hangar 18 High Desert', '15315 Cholame Rd Unit D, Victorville, CA 92392', 'Victorville', 'CA', 'United States', 'us', 'Hangar 18', 34.5020598, -117.3297115, 'classic'),
  ('Hangar 18 Long Beach', '2599 E Willow St, Signal Hill, CA 90755', 'Signal Hill', 'CA', 'United States', 'us', 'Hangar 18', 33.8044110, -118.1625130, 'classic'),
  ('Hangar 18 Mission Viejo', '23812 Via Fabricante Suite A4, Mission Viejo, CA 92691', 'Mission Viejo', 'CA', 'United States', 'us', 'Hangar 18', 33.6171919, -117.6824967, 'classic'),
  ('Hangar 18 Orange', '1547 W Struck Ave Suite A, Orange, CA 92867', 'Orange', 'CA', 'United States', 'us', 'Hangar 18', 33.8061380, -117.8682051, 'classic'),
  ('Hangar 18 Rancho Cucamonga', '9004 Hyssop Dr, Rancho Cucamonga, CA 91730', 'Rancho Cucamonga', 'CA', 'United States', 'us', 'Hangar 18', 34.0887052, -117.5429999, 'classic'),
  ('Hangar 18 Riverside', '6935 Arlington Ave, Riverside, CA 92503', 'Riverside', 'CA', 'United States', 'us', 'Hangar 18', 33.9459413, -117.4461259, 'classic'),
  ('Hangar 18 San Clemente', '1031 Calle Trepadora Unit A, San Clemente, CA 92673', 'San Clemente', 'CA', 'United States', 'us', 'Hangar 18', 33.4536328, -117.6007953, 'classic'),
  ('Hangar 18 Upland', '256 E Stowell St Suite A, Upland, CA 91786', 'Upland', 'CA', 'United States', 'us', 'Hangar 18', 34.0939185, -117.6478863, 'classic'),
  ('The Climbing Hangar Bristol', '15-29 Union St, Bristol BS1 2DF', 'Bristol', 'England', 'United Kingdom', 'gb', 'The Climbing Hangar', 51.4563065, -2.5912471, 'classic'),
  ('The Climbing Hangar Edinburgh', '4 East Telferton, Edinburgh EH7 6XD', 'Edinburgh', 'Scotland', 'United Kingdom', 'gb', 'The Climbing Hangar', 55.9560589, -3.1241059, 'classic'),
  ('The Climbing Hangar Exeter', '6 Marsh Green Rd N, Exeter EX2 8NY', 'Exeter', 'England', 'United Kingdom', 'gb', 'The Climbing Hangar', 50.7089289, -3.5278128, 'classic'),
  ('The Climbing Hangar Liverpool North', '6 Birchall St, Liverpool L20 8PD', 'Liverpool', 'England', 'United Kingdom', 'gb', 'The Climbing Hangar', 53.4319306, -2.9915826, 'classic'),
  ('The Climbing Hangar Liverpool South', 'Units 14 & 15, The Matchworks, 40 Speke Rd, Liverpool L19 2RF', 'Liverpool', 'England', 'United Kingdom', 'gb', 'The Climbing Hangar', 53.3497914, -2.8863946, 'classic'),
  ('The Climbing Hangar Plymouth', 'Unit 9, Burrington Business Park, Plymouth PL5 3LX', 'Plymouth', 'England', 'United Kingdom', 'gb', 'The Climbing Hangar', 50.4037603, -4.1670056, 'classic'),
  ('The Climbing Hangar Reading', 'Unit 8 Stadium Way, Reading RG30 6BX', 'Reading', 'England', 'United Kingdom', 'gb', 'The Climbing Hangar', 51.4634208, -1.0129267, 'classic'),
  ('The Climbing Hangar Sheffield', 'Units A & B, 15 Sutherland St, Sheffield S4 7WG', 'Sheffield', 'England', 'United Kingdom', 'gb', 'The Climbing Hangar', 53.3908394, -1.4507539, 'classic'),
  ('The Climbing Hangar Southampton', 'Third Ave, Southampton SO15 0LD', 'Southampton', 'England', 'United Kingdom', 'gb', 'The Climbing Hangar', 50.9159030, -1.4547489, 'classic'),
  ('The Climbing Hangar Swansea', 'Unit 3, Castell Close, Swansea SA7 9FH', 'Swansea', 'Wales', 'United Kingdom', 'gb', 'The Climbing Hangar', 51.6568521, -3.9077982, 'classic');

-- Correct misspelled/partial copies before upserting the authoritative rows.
update public.gyms
set name = regexp_replace(name, '^Hanger 18', 'Hangar 18', 'i'),
    brand = case when name ~* '^Hanger 18' then 'Hangar 18' else brand end
where name ~* '^Hanger 18';

update public.gyms g
set name = i.name, address = i.address, city = i.city, state = i.state,
    country = i.country, cc = i.cc, brand = i.brand,
    latitude = i.latitude, longitude = i.longitude,
    status = 'approved', grading_style = i.grading_style
from requested_gyms i
where (
  regexp_replace(lower(g.name), '[^a-z0-9]+', '', 'g') =
    regexp_replace(lower(i.name), '[^a-z0-9]+', '', 'g')
  and lower(coalesce(g.city, '')) = lower(i.city)
) or (
  g.latitude is not null and g.longitude is not null
  and abs(g.latitude - i.latitude) < 0.0015
  and abs(g.longitude - i.longitude) < 0.0015
);

insert into public.gyms (
  name, address, city, state, country, cc, brand, latitude, longitude,
  status, grading_style
)
select name, address, city, state, country, cc, brand, latitude, longitude,
       'approved', grading_style
from requested_gyms i
where not exists (
  select 1 from public.gyms g
  where regexp_replace(lower(g.name), '[^a-z0-9]+', '', 'g') =
          regexp_replace(lower(i.name), '[^a-z0-9]+', '', 'g')
    and lower(coalesce(g.city, '')) = lower(i.city)
);

-- Keep exactly one Fayetteville Boulders & Brews and give it the requested
-- custom circuit scale.
update public.gyms
set name = 'Boulders & Brews',
    address = '612 W Dickson St, Fayetteville, AR 72701',
    city = 'Fayetteville', state = 'AR', country = 'United States', cc = 'us',
    brand = 'Boulders & Brews', latitude = 36.0672597, longitude = -94.1671444,
    status = 'approved', grading_style = 'brew_bands'
where city ilike 'Fayetteville'
  and lower(name) ~ 'boulders?.*brews?';

-- True physical duplicates: same normalized name at essentially identical
-- coordinates/address. Boulders & Brews is deliberately grouped by city.
create temporary table gym_duplicate_map on commit drop as
with prepared as (
  select id,
    case
      when city ilike 'Fayetteville' and lower(name) ~ 'boulders?.*brews?'
        then 'bouldersbrews'
      else regexp_replace(lower(regexp_replace(name, '^Hanger', 'Hangar', 'i')), '[^a-z0-9]+', '', 'g')
    end as normalized_name,
    case
      when city ilike 'Fayetteville' and lower(name) ~ 'boulders?.*brews?'
        then 'fayetteville:ar'
      when latitude is not null and longitude is not null
        then round(latitude::numeric, 3)::text || ':' || round(longitude::numeric, 3)::text
      else lower(coalesce(address, '')) || ':' || lower(coalesce(city, '')) || ':' || lower(coalesce(state, ''))
    end as location_key,
    status, address, city, state, country, latitude, longitude
  from public.gyms
), ranked as (
  select id,
    first_value(id) over (
      partition by normalized_name, location_key
      order by (status = 'approved') desc,
        ((address is not null)::int + (city is not null)::int + (state is not null)::int +
         (country is not null)::int + (latitude is not null)::int + (longitude is not null)::int) desc,
        id
    ) as canonical_id
  from prepared
)
select id as duplicate_id, canonical_id from ranked where id <> canonical_id;

-- Resolve the only known unique gym reference before updating the remaining
-- foreign keys dynamically.
insert into public.gym_unlocks (user_id, gym_id, unlocked_at)
select gu.user_id, m.canonical_id, min(gu.unlocked_at)
from public.gym_unlocks gu
join gym_duplicate_map m on m.duplicate_id = gu.gym_id
group by gu.user_id, m.canonical_id
on conflict (user_id, gym_id) do update
set unlocked_at = least(public.gym_unlocks.unlocked_at, excluded.unlocked_at);

delete from public.gym_unlocks gu
using gym_duplicate_map m
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
      'update %I.%I t set %I = m.canonical_id from gym_duplicate_map m where t.%I = m.duplicate_id',
      ref.schema_name, ref.table_name, ref.column_name, ref.column_name
    );
  end loop;
end $$;

delete from public.gyms g
using gym_duplicate_map m
where g.id = m.duplicate_id;

commit;
