-- ============================================================================
-- Klimb — Arkansas gym additions + coordinate corrections.
-- Run AFTER 0003_seed_gyms.sql. Idempotent: skips rows already present
-- (matched on name + city).
-- ============================================================================
insert into public.gyms (name, city, state, country, cc, brand, latitude, longitude, status, grading_style)
select v.name, v.city, v.state, 'United States', 'us', v.brand, v.lat, v.lng, 'approved', v.gs
from (values
  ('Climb Fayetteville',              'Fayetteville',   'AR', null::text, 36.1063, -94.1802, 'classic'),
  ('Climb Conway',                    'Conway',         'AR', null::text, 35.0887, -92.4421, 'classic'),
  ('Vertical Horizons Climbing Gym',  'Fort Smith',     'AR', null::text, 35.3437, -94.3186, 'classic'),
  ('Upward Ninja and Bouldering',     'Siloam Springs', 'AR', null::text, 36.1490, -94.5040, 'classic')
) as v(name, city, state, brand, lat, lng, gs)
where not exists (
  select 1 from public.gyms g
  where g.name = v.name and coalesce(g.city, '') = coalesce(v.city, '')
);

-- Correct coordinates that pointed to the wrong part of town.
-- Little Rock Climbing Center — 12120 Colonel Glenn Rd (west Little Rock).
update public.gyms set latitude = 34.7185, longitude = -92.4045
  where name = 'Little Rock Climbing Center' and city = 'Little Rock';

-- Boulders and Brews — 612 W Dickson St (Dickson St entertainment district).
update public.gyms set latitude = 36.0665, longitude = -94.1690
  where name = 'Boulders and Brews' and city = 'Fayetteville';
