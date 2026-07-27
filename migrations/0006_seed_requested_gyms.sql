-- Requested community gyms. Idempotent: existing matching rows are approved
-- and refreshed; missing rows are inserted.

-- Pulse Climbing Warners Bay
-- 2A/305 Hillsborough Road, Warners Bay NSW 2282, Australia
update public.gyms
set
  state = 'New South Wales',
  country = 'Australia',
  cc = 'au',
  brand = 'Pulse Climbing',
  latitude = -32.96407,
  longitude = 151.66011,
  status = 'approved',
  grading_style = 'classic'
where lower(name) = lower('Pulse Climbing Warners Bay')
  and lower(coalesce(city, '')) = lower('Warners Bay');

insert into public.gyms (
  name, city, state, country, cc, brand,
  latitude, longitude, status, grading_style
)
select
  'Pulse Climbing Warners Bay', 'Warners Bay', 'New South Wales',
  'Australia', 'au', 'Pulse Climbing',
  -32.96407, 151.66011, 'approved', 'classic'
where not exists (
  select 1 from public.gyms
  where lower(name) = lower('Pulse Climbing Warners Bay')
    and lower(coalesce(city, '')) = lower('Warners Bay')
);

-- Sportrock Alexandria
-- 5308 Eisenhower Avenue, Alexandria, VA 22304
update public.gyms
set
  state = 'Virginia',
  country = 'United States',
  cc = 'us',
  brand = 'Sportrock',
  latitude = 38.80113,
  longitude = -77.12614,
  status = 'approved',
  grading_style = 'classic'
where lower(name) = lower('Sportrock Alexandria')
  and lower(coalesce(city, '')) = lower('Alexandria');

insert into public.gyms (
  name, city, state, country, cc, brand,
  latitude, longitude, status, grading_style
)
select
  'Sportrock Alexandria', 'Alexandria', 'Virginia',
  'United States', 'us', 'Sportrock',
  38.80113, -77.12614, 'approved', 'classic'
where not exists (
  select 1 from public.gyms
  where lower(name) = lower('Sportrock Alexandria')
    and lower(coalesce(city, '')) = lower('Alexandria')
);

-- CoMo Rocks
-- 205 E Nifong Boulevard, Suite 120, Columbia, MO 65203
update public.gyms
set
  state = 'Missouri',
  country = 'United States',
  cc = 'us',
  brand = 'CoMo Rocks',
  latitude = 38.91098,
  longitude = -92.33696,
  status = 'approved',
  grading_style = 'classic'
where lower(name) = lower('CoMo Rocks')
  and lower(coalesce(city, '')) = lower('Columbia');

insert into public.gyms (
  name, city, state, country, cc, brand,
  latitude, longitude, status, grading_style
)
select
  'CoMo Rocks', 'Columbia', 'Missouri',
  'United States', 'us', 'CoMo Rocks',
  38.91098, -92.33696, 'approved', 'classic'
where not exists (
  select 1 from public.gyms
  where lower(name) = lower('CoMo Rocks')
    and lower(coalesce(city, '')) = lower('Columbia')
);

-- CRUX - Sala de Boulder
-- Aguascalientes, Aguascalientes, Mexico
update public.gyms
set
  state = 'Aguascalientes',
  country = 'Mexico',
  cc = 'mx',
  brand = 'CRUX',
  latitude = 21.90628,
  longitude = -102.29729,
  status = 'approved',
  grading_style = 'classic'
where lower(name) in (
    lower('CRUX - Sala de Boulder'),
    lower('Crux Sala Boulder'),
    lower('Crux Aguascalientes')
  )
  and lower(coalesce(city, '')) = lower('Aguascalientes');

insert into public.gyms (
  name, city, state, country, cc, brand,
  latitude, longitude, status, grading_style
)
select
  'CRUX - Sala de Boulder', 'Aguascalientes', 'Aguascalientes',
  'Mexico', 'mx', 'CRUX',
  21.90628, -102.29729, 'approved', 'classic'
where not exists (
  select 1 from public.gyms
  where lower(name) in (
      lower('CRUX - Sala de Boulder'),
      lower('Crux Sala Boulder'),
      lower('Crux Aguascalientes')
    )
    and lower(coalesce(city, '')) = lower('Aguascalientes')
);
