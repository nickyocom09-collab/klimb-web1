-- Ensure CIBA Climbing is present on the Klimb map with verified coordinates.
-- Address: https://cibaclimbing.com/hours-location
-- Coordinates geocoded from the official street address via OpenStreetMap.

begin;

with existing as (
  select id
  from public.gyms
  where lower(coalesce(city, '')) = 'sierra vista'
    and regexp_replace(lower(name), '[^a-z0-9]+', '', 'g') in
        ('ciba', 'cibaclimbing', 'cibaclimbinggym')
  order by (status = 'approved') desc, id
  limit 1
), updated as (
  update public.gyms g
  set name = 'CIBA Climbing Gym',
      address = '4066 E Monsanto Dr, Suite B, Sierra Vista, AZ 85650',
      city = 'Sierra Vista',
      state = 'AZ',
      country = 'United States',
      cc = 'us',
      brand = 'CIBA Climbing',
      latitude = 31.4999743,
      longitude = -110.2554464,
      status = 'approved',
      grading_style = 'classic'
  where g.id in (select id from existing)
  returning g.id
)
insert into public.gyms (
  name, address, city, state, country, cc, brand, latitude, longitude,
  status, grading_style
)
select
  'CIBA Climbing Gym',
  '4066 E Monsanto Dr, Suite B, Sierra Vista, AZ 85650',
  'Sierra Vista', 'AZ', 'United States', 'us', 'CIBA Climbing',
  31.4999743, -110.2554464, 'approved', 'classic'
where not exists (select 1 from updated);

commit;
