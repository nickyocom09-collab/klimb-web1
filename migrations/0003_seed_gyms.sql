-- ============================================================================
-- Klimb — Seed pre-populated US climbing gyms (status = 'approved').
-- Run AFTER 0002_features.sql. Idempotent: skips rows already present
-- (matched on name + city).
-- ============================================================================
insert into public.gyms (name, city, state, brand, latitude, longitude, status)
select v.name, v.city, v.state, v.brand, v.lat, v.lng, 'approved'
from (values
  -- Movement (formerly Movement/Earth Treks chain)
  ('Movement Denver',            'Denver',          'CO', 'Movement',          39.7596, -104.9876),
  ('Movement Englewood',         'Englewood',       'CO', 'Movement',          39.6478, -104.9878),
  ('Movement Boulder',           'Boulder',         'CO', 'Movement',          40.0274, -105.2519),
  ('Movement Baker',             'Denver',          'CO', 'Movement',          39.7117, -104.9876),
  ('Movement RiNo',              'Denver',          'CO', 'Movement',          39.7700, -104.9810),
  ('Movement Dallas Design District','Dallas',      'TX', 'Movement',          32.7950, -96.8190),
  ('Movement Plano',             'Plano',           'TX', 'Movement',          33.0198, -96.7600),
  ('Movement Lincoln Park',      'Chicago',         'IL', 'Movement',          41.9214, -87.6513),
  ('Movement Crystal City',      'Arlington',       'VA', 'Movement',          38.8576, -77.0510),
  ('Movement Columbia',          'Columbia',        'MD', 'Movement',          39.1857, -76.8131),
  ('Movement Timonium',          'Timonium',        'MD', 'Movement',          39.4490, -76.6260),
  ('Movement Rockville',         'Rockville',       'MD', 'Movement',          39.0840, -77.1528),
  ('Movement Hampden',           'Baltimore',       'MD', 'Movement',          39.3260, -76.6360),
  ('Movement Golden',            'Golden',          'CO', 'Movement',          39.7555, -105.2211),
  ('Movement NoHo',              'Los Angeles',     'CA', 'Movement',          34.1670, -118.3760),

  -- Earth Treks (remaining-brand locations)
  ('Earth Treks Englewood',      'Englewood',       'CO', 'Earth Treks',       39.6470, -104.9870),
  ('Earth Treks Crystal City',   'Arlington',       'VA', 'Earth Treks',       38.8570, -77.0500),

  -- Brooklyn Boulders
  ('Brooklyn Boulders Gowanus',  'Brooklyn',        'NY', 'Brooklyn Boulders', 40.6790, -73.9930),
  ('Brooklyn Boulders Queensbridge','Long Island City','NY','Brooklyn Boulders',40.7560,-73.9430),
  ('Brooklyn Boulders Somerville','Somerville',     'MA', 'Brooklyn Boulders', 42.3900, -71.0890),
  ('Brooklyn Boulders Chicago',  'Chicago',         'IL', 'Brooklyn Boulders', 41.8880, -87.6520),

  -- Planet Granite / Movement (Bay Area)
  ('Planet Granite San Francisco','San Francisco',  'CA', 'Planet Granite',    37.8050, -122.4480),
  ('Planet Granite Sunnyvale',   'Sunnyvale',       'CA', 'Planet Granite',    37.4030, -122.0190),
  ('Planet Granite Belmont',     'Belmont',         'CA', 'Planet Granite',    37.5160, -122.2960),
  ('Planet Granite Portland',    'Portland',        'OR', 'Planet Granite',    45.5340, -122.6680),

  -- Mesa Rim
  ('Mesa Rim Mira Mesa',         'San Diego',       'CA', 'Mesa Rim',          32.9120, -117.1430),
  ('Mesa Rim Mission Valley',    'San Diego',       'CA', 'Mesa Rim',          32.7700, -117.1480),
  ('Mesa Rim Reno',              'Reno',            'NV', 'Mesa Rim',          39.5450, -119.8150),
  ('Mesa Rim Austin',            'Austin',          'TX', 'Mesa Rim',          30.2050, -97.7560),

  -- Sender One
  ('Sender One LAX',             'Los Angeles',     'CA', 'Sender One',        33.9200, -118.3920),
  ('Sender One Santa Ana',       'Santa Ana',       'CA', 'Sender One',        33.7170, -117.8680),
  ('Sender One Playa Vista',     'Los Angeles',     'CA', 'Sender One',        33.9750, -118.4180),
  ('Sender One SNA',             'Santa Ana',       'CA', 'Sender One',        33.7180, -117.8690),

  -- The Spot
  ('The Spot Bouldering Gym',    'Boulder',         'CO', 'The Spot',          40.0190, -105.2510),
  ('The Spot Denver',            'Denver',          'CO', 'The Spot',          39.7660, -104.9690),
  ('The Spot Golden',            'Golden',          'CO', 'The Spot',          39.7540, -105.2200),

  -- Momentum (Utah + Texas)
  ('Momentum Millcreek',         'Salt Lake City',  'UT', 'Momentum',          40.6890, -111.8230),
  ('Momentum Sandy',             'Sandy',           'UT', 'Momentum',          40.5710, -111.8590),
  ('Momentum Lehi',              'Lehi',            'UT', 'Momentum',          40.3920, -111.8510),
  ('Momentum Katy',              'Katy',            'TX', 'Momentum',          29.7860, -95.8240),
  ('Momentum Silver Street',     'Houston',         'TX', 'Momentum',          29.7530, -95.3640),

  -- Touchstone (California)
  ('Dogpatch Boulders',          'San Francisco',   'CA', 'Touchstone',        37.7600, -122.3890),
  ('Mission Cliffs',             'San Francisco',   'CA', 'Touchstone',        37.7640, -122.4120),
  ('The Studio Climbing',        'San Jose',        'CA', 'Touchstone',        37.3370, -121.8900),
  ('Berkeley Ironworks',         'Berkeley',        'CA', 'Touchstone',        37.8520, -122.2930),
  ('Great Western Power Co.',    'Oakland',         'CA', 'Touchstone',        37.8290, -122.2870),
  ('Sacramento Pipeworks',       'Sacramento',      'CA', 'Touchstone',        38.5760, -121.4690),
  ('LA Boulders',                'Los Angeles',     'CA', 'Touchstone',        34.0700, -118.2340),
  ('Cliffs of Id',               'Culver City',     'CA', 'Touchstone',        34.0210, -118.3870),

  -- Triangle Rock Club (North Carolina + VA)
  ('Triangle Rock Club Raleigh', 'Raleigh',         'NC', 'Triangle Rock Club',35.8990, -78.6470),
  ('Triangle Rock Club Morrisville','Morrisville',  'NC', 'Triangle Rock Club',35.8230, -78.8250),
  ('Triangle Rock Club Durham',  'Durham',          'NC', 'Triangle Rock Club',35.9940, -78.8990),
  ('Triangle Rock Club Fayetteville','Fayetteville','NC','Triangle Rock Club', 35.0530, -78.8780),

  -- Seattle area
  ('Vertical World Seattle',     'Seattle',         'WA', 'Vertical World',    47.6660, -122.3760),
  ('Vertical World Redmond',     'Redmond',         'WA', 'Vertical World',    47.6740, -122.1210),
  ('Stone Gardens Seattle',      'Seattle',         'WA', 'Stone Gardens',     47.6650, -122.3760),
  ('Stone Gardens Bellevue',     'Bellevue',        'WA', 'Stone Gardens',     47.6010, -122.1860),
  ('Seattle Bouldering Project', 'Seattle',         'WA', 'Bouldering Project',47.5990, -122.3170),

  -- Bouldering Project (other cities)
  ('Austin Bouldering Project',  'Austin',          'TX', 'Bouldering Project',30.2640, -97.7130),
  ('Austin Bouldering Project Springdale','Austin', 'TX', 'Bouldering Project',30.2820, -97.6860),
  ('Minneapolis Bouldering Project','Minneapolis',  'MN', 'Bouldering Project',44.9620, -93.2480),
  ('Denver Bouldering Club',     'Denver',          'CO', 'Bouldering Project',39.7600, -104.9700),

  -- Other notable gyms
  ('Red Rock Climbing Center',   'Las Vegas',       'NV', null,                36.1530, -115.2240),
  ('Origin Climbing Las Vegas',  'Las Vegas',       'NV', 'Origin',            36.1620, -115.1180),
  ('Chicago Cliffs',             'Chicago',         'IL', null,                41.8530, -87.6650),
  ('First Ascent Avondale',      'Chicago',         'IL', 'First Ascent',      41.9390, -87.7080),
  ('First Ascent Uptown',        'Chicago',         'IL', 'First Ascent',      41.9690, -87.6570),
  ('Brooklyn Bouldering',        'Brooklyn',        'NY', null,                40.6580, -73.9230),
  ('The Cliffs at LIC',          'Long Island City','NY', 'The Cliffs',        40.7370, -73.9370),
  ('The Cliffs at Callowhill',   'Philadelphia',    'PA', 'The Cliffs',        39.9610, -75.1560),
  ('MetroRock Everett',          'Everett',         'MA', 'MetroRock',         42.4080, -71.0530),
  ('Central Rock Gym Boston',    'Boston',          'MA', 'Central Rock Gym',  42.3700, -71.0250),
  ('Gravity Vault Hoboken',      'Hoboken',         'NJ', 'Gravity Vault',     40.7370, -74.0320),
  ('Vital Climbing Brooklyn',    'Brooklyn',        'NY', 'Vital',             40.7110, -73.9650),
  ('Ascend Pittsburgh',          'Pittsburgh',      'PA', 'Ascend',            40.4640, -79.9650),
  ('Inner Peaks Charlotte',      'Charlotte',       'NC', null,                35.1500, -80.8200),
  ('Stronghold Climbing Gym',    'Phoenix',         'AZ', null,                33.4480, -112.0740),
  ('Focus Climbing Center',      'Mesa',            'AZ', null,                33.4150, -111.8310),
  ('The Front Climbing Club',    'Salt Lake City',  'UT', 'The Front',         40.7270, -111.8880)
) as v(name, city, state, brand, lat, lng)
where not exists (
  select 1 from public.gyms g
  where g.name = v.name and coalesce(g.city, '') = coalesce(v.city, '')
);
