-- Klimb gym import — generated 2026-08-01T05:01:43.840Z
-- 221 geocoded gyms (272 scanned, 51 skipped as non-gym / ungeocodable).
-- Dedupe-safe: skips anything within 250 m of an existing approved gym or with
-- the same normalized name+city. Review, then run in the Supabase SQL Editor
-- (or hand this file to the Klimb assistant to apply).

INSERT INTO gyms (name, city, state, country, cc, latitude, longitude, status, grading_style)
SELECT c.name, c.city, c.state, 'United States', 'us', c.lat, c.lng, 'approved', 'classic'
FROM (VALUES
  ('Birmingham Boulders', 'Birmingham', 'AL', 33.45192, -86.8508),
  ('High Point Climbing And Fitness: Birmingham', 'Birmingham', 'AL', 33.42535, -86.70402),
  ('Gadrock', 'Gadsden', 'AL', 33.98725, -86.0046),
  ('Johnson Legacy Center', 'Huntsville', 'AL', 34.79768, -86.60133),
  ('Crux Climbing', 'Northport', 'AL', 33.23064, -87.60817),
  ('Alaska Rock Gym', 'Anchorage', 'AK', 61.19147, -149.87099),
  ('Alta Boulders - Chandler', 'Chandler', 'AZ', 33.2635, -111.85628),
  ('Alta Climbing & Fitness - Gilbert', 'Gilbert', 'AZ', 33.29016, -111.69274),
  ('Focus Climbing Center LLC', 'Mesa', 'AZ', 33.40886, -111.87813),
  ('Black Rock Bouldering Gym', 'Phoenix', 'AZ', 33.58134, -112.01364),
  ('Arizona Bouldering Project', 'Tempe', 'AZ', 33.40057, -111.9529),
  ('Climb Bentonville', 'Bentonville', 'AR', 36.35724, -94.21948),
  ('Bridges Rock Gym', 'El Cerrito', 'CA', 37.90011, -122.30742),
  ('Gold Crush Climbing Gym', 'Grass Valley', 'CA', 39.2193, -121.03312),
  ('Sender One Lakewood', 'Lakewood', 'CA', 33.84697, -118.14259),
  ('Rockzilla', 'Napa', 'CA', 38.30733, -122.28843),
  ('Hangar 18 Rancho Cucamonga', 'Rancho Cucamonga', 'CA', 34.08871, -117.543),
  ('Flowstone Climbing', 'Redlands', 'CA', 34.05517, -117.20503),
  ('Grotto Climbing & Yoga', 'San Diego', 'CA', 32.7804, -117.09811),
  ('Mesa Rim - Mira Mesa', 'San Diego', 'CA', 32.90227, -117.1777),
  ('Mesa Rim - Mission Valley', 'San Diego', 'CA', 32.75963, -117.16123),
  ('The Wall Climbing Gym', 'Vista', 'CA', 33.13657, -117.2305),
  ('The Spot - Boulder', 'Boulder', 'CO', 40.02162, -105.25061),
  ('BVRocks', 'Buena Vista', 'CO', 38.82911, -106.11988),
  ('CityROCK', 'Colorado Springs', 'CO', 38.83475, -104.82111),
  ('Movement Climbing + Fitness Denver', 'Denver', 'CO', 39.72519, -105.00251),
  ('The Spot - Denver', 'Denver', 'CO', 39.73607, -104.99329),
  ('Übergrippen Indoor Climbing Crag', 'Denver', 'CO', 39.74853, -104.8876),
  ('Eagle Climbing + Fitness', 'Eagle', 'CO', 39.6619, -106.82127),
  ('Ascent Studio Climbing and Fitness', 'Fort Collins', 'CO', 40.55915, -105.0409),
  ('Whetstone Climbing & Fitness', 'Fort Collins', 'CO', 40.50659, -105.07547),
  ('The Spot - Golden', 'Golden', 'CO', 39.77849, -105.23526),
  ('Grand Valley Climbing', 'Grand Junction', 'CO', 39.09355, -108.59086),
  ('The Spot - Louisville', 'Louisville', 'CO', 39.96585, -105.11675),
  ('Wooden Mountain Bouldering Gym', 'Loveland', 'CO', 40.401, -105.05614),
  ('Steamboat Climbing Collective', 'Steamboat', 'CO', 40.50692, -106.85798),
  ('The Rock Club', 'New Rochelle', 'CT', 40.91764, -73.77603),
  ('Beaches Rock Gym - Atlantic Beach', 'Atlantic Beach', 'FL', 30.32644, -81.41919),
  ('DynoClimb', 'DeLand', 'FL', 29.02042, -81.30356),
  ('The Knot Climbing Gym', 'Gainesville', 'FL', 29.64555, -82.3253),
  ('Aiguille Rock Climbing Center', 'Longwood', 'FL', 28.69903, -81.34645),
  ('Velocity Climbing Gym', 'Miami', 'FL', 25.81284, -80.23395),
  ('ProjectRock', 'Oakland Park', 'FL', 26.17191, -80.14536),
  ('Blue Swan Boulders', 'Orlando', 'FL', 28.54635, -81.38317),
  ('Central Rock', 'Orlando', 'FL', 28.45064, -81.45328),
  ('Rox Climbing Gym', 'Orlando', 'FL', 28.37131, -81.28158),
  ('Weatherford''s Outback', 'Pensacola', 'FL', 30.42512, -87.1819),
  ('Daytona Climbing Company', 'SOUTH DAYTONA', 'FL', 29.15348, -80.99581),
  ('Vertical Ventures', 'St. Petersburg', 'FL', 27.7695, -82.65757),
  ('The Overlook', 'Atlanta', 'GA', 33.73156, -84.42126),
  ('Riverside Epicenter', 'Austell', 'GA', 33.77188, -84.55721),
  ('Stone Summit Climbing and Fitness Center', 'Kennesaw', 'GA', 34.04738, -84.5831),
  ('Active Climbing', 'St Athens', 'GA', 33.96871, -83.38732),
  ('The Edge Climbing & Fitness', 'Ammon', 'ID', 43.50866, -111.97882),
  ('The Commons Climbing Club', 'Boise', 'ID', 43.61105, -116.24046),
  ('Vertical View', 'Meridian', 'ID', 43.59278, -116.37776),
  ('The Rock Gym - Rexburg', 'Rexburg', 'ID', 43.83159, -111.80991),
  ('Gemstone Climbing', 'Twin Falls', 'ID', 42.55298, -114.47447),
  ('First Ascent Arlington Heights', 'Arlington Heights', 'IL', 42.09056, -88.02448),
  ('First Ascent Climbing & Fitness', 'Chicago', 'IL', 41.94512, -87.71038),
  ('First Ascent Humboldt Park', 'Chicago', 'IL', 41.89647, -87.70155),
  ('Lakeshore Sport & Fitness', 'Chicago', 'IL', 41.88615, -87.62194),
  ('Maggie Daley Park', 'Chicago', 'IL', 41.88395, -87.61912),
  ('Movement Climbing + Fitness - Lincoln Park', 'Chicago', 'IL', 41.90799, -87.64958),
  ('CLIMB ON ROCK GYM', 'Homewood', 'IL', 41.56044, -87.66858),
  ('The Proving Ground Bouldering Gym', 'Normal', 'IL', 40.50922, -88.95974),
  ('FFC Oak Park Health Club', 'Oak Park', 'IL', 41.88855, -87.80293),
  ('First Ascent Climbing & Fitness', 'Peoria', 'IL', 40.68424, -89.59934),
  ('Life Time Climb', 'Warrenville', 'IL', 41.8033, -88.1743),
  ('Movement Climbing + Fitness - Wrigleyville', 'Wrigleyville', 'IL', 41.94702, -87.65767),
  ('Apex Climbing Gym', 'Mishawaka', 'IN', 41.71033, -86.18771),
  ('SOKO Outfitters', 'Cedar Rapids', 'IA', 41.96554, -91.66001),
  ('Climb Iowa', 'Des Moines', 'IA', 41.58636, -93.61193),
  ('Climb Iowa', 'Grimes', 'IA', 41.65932, -93.766),
  ('Great River Health Center', 'West Burlington', 'IA', 40.81157, -91.17269),
  ('IBEX Climbing Gym', 'Blue Springs', 'KS', 39.02977, -94.27367),
  ('RoKC - Olathe', 'Olathe', 'KS', 38.88989, -94.79541),
  ('Bliss Bouldering & Climbing Complex', 'Wichita', 'KS', 37.73633, -97.20926),
  ('L’Escalade Fitness Center', 'Lexington', 'KY', 38.06054, -84.48058),
  ('Climb NuLu', 'Louisville', 'KY', 38.25216, -85.73382),
  ('Rocksport climbing gym', 'Louisville', 'KY', 38.21211, -85.5293),
  ('Rocksport', 'Louisville', 'KY', 38.21211, -85.5293),
  ('BREC Perkins Road Community Park', 'Baton Rouge', 'LA', 30.39909, -91.11596),
  ('UpTown Climbing', 'Baton Rouge', 'LA', 30.41752, -91.06372),
  ('Risen Rock Climbing Gym', 'Bossier City', 'LA', 32.58428, -93.72949),
  ('Southern Stone Indoor Climbing', 'Lafayette', 'LA', 30.1859, -92.06409),
  ('New Orleans Boulder Lounge', 'New Orleans', 'LA', 29.96869, -90.05264),
  ('Maine Bound Adventure Center', 'Orono', 'ME', 44.89879, -68.66649),
  ('Salt Pump Climbing Company', 'Scarborough', 'ME', 43.59248, -70.36221),
  ('Volta Climbing and Fitness', 'Trenton', 'ME', 44.46578, -68.36012),
  ('Momentum - Timonium', 'Timonium', 'MD', 39.43231, -76.62975),
  ('Central Rock Gym - Boston', 'Boston', 'MA', 42.36506, -71.05893),
  ('DICK''S House of Sport', 'Boston', 'MA', 42.34881, -71.07992),
  ('Central Rock Gym - Cambridge', 'Cambridge', 'MA', 42.394, -71.15159),
  ('Central Rock Gym Harvard Square', 'Cambridge', 'MA', 42.37314, -71.12024),
  ('Central Rock Gym - Framingham', 'Framingham', 'MA', 42.31858, -71.39741),
  ('Challenge Rocks', 'Hingham', 'MA', 42.1763, -70.91979),
  ('The El Dojo', 'Northampton', 'MA', 42.33073, -72.67931),
  ('Central Rock Gym - Randolph', 'Randolph', 'MA', 42.19957, -71.06647),
  ('Central Rock Gym - Stoneham', 'Stoneham', 'MA', 42.47772, -71.11089),
  ('Central Rock Gym - Waltham', 'Waltham', 'MA', 42.38751, -71.20312),
  ('Central Rock Gym', 'Worcester', 'MA', 42.29696, -71.79722),
  ('Inside Movee Climbing Gym', 'Byron Center', 'MI', 42.82688, -85.72894),
  ('Dyno Detroit', 'Detroit', 'MI', 42.35309, -83.04062),
  ('Calvin Climbing Center', 'Grand Rapids', 'MI', 42.92992, -85.58533),
  ('Planet Rock - Grand Rapids', 'Grand Rapids', 'MI', 42.91586, -85.65167),
  ('Terra Firma Bouldering Co.', 'Grand Rapids', 'MI', 42.93531, -85.64644),
  ('Climb Kalamazoo', 'Kalamazoo', 'MI', 42.29311, -85.58337),
  ('Planet Rock - Madison Heights', 'Madison Heights', 'MI', 42.51901, -83.11709),
  ('Adventure Seminars', 'Mt Pleasant', 'MI', 43.5981, -84.77415),
  ('Gripz Gym', 'Southfield', 'MI', 42.44859, -83.28601),
  ('ELEV8 Climbing and Fitness', 'Traverse City', 'MI', 44.75821, -85.60607),
  ('Vertical Endeavors- Bloomington', 'Bloomington', 'MN', 44.82925, -93.30062),
  ('Vertical Endeavors- St. Paul', 'Saint Paul', 'MN', 44.96645, -93.06469),
  ('Vertical Endeavors- Twin Cities Bouldering', 'Saint Paul', 'MN', 44.9605, -93.20681),
  ('MGCCC Estuarine Education Center', 'Gautier', 'MS', 30.39412, -88.65027),
  ('The Hangout', 'Ridgeland', 'MS', 32.40105, -90.1442),
  ('Upper Limits - Chesterfield', 'Chesterfield', 'MO', 38.66367, -90.60581),
  ('RoKC - Underground', 'Kansas City', 'MO', 39.06979, -94.60143),
  ('RoKC - North Kansas City', 'North Kansas City', 'MO', 39.13609, -94.57259),
  ('RoKC - Olathe', 'Olathe', 'MO', 38.88989, -94.79541),
  ('Zenith Climbing Center', 'Springfield', 'MO', 37.18012, -93.22207),
  ('Upper Limits - Maryland Heights', 'St. Louis', 'MO', 38.69468, -90.41241),
  ('Steepworld Climbing & Fitness', 'Billings', 'MT', 45.74735, -108.59332),
  ('The Hi-Line Climbing Center', 'Great Falls', 'MT', 47.50413, -111.29699),
  ('1st Ascent Climbing & Fitness', 'Libby', 'MT', 48.39197, -115.55177),
  ('RockFish Climbing & Fitness', 'Whitefish', 'MT', 48.39465, -114.33458),
  ('MW Climbing', 'Lincoln', 'NE', 40.81753, -96.65157),
  ('Evolution Rock & Fitness *UPDATE TO NH Climbing & Fitness', 'Concord', 'NH', 43.19064, -71.53146),
  ('The Notch Climbing Gym', 'Lebanon', 'NH', 43.65277, -72.2418),
  ('The Gravity Vault - Flemington', 'Flemington', 'NJ', 40.53018, -74.85117),
  ('Goat Climbing Gym', 'Hackensack', 'NJ', 40.88021, -74.04189),
  ('Iron Peaks', 'Hillsborough Township', 'NJ', 40.48179, -74.66606),
  ('Gravity Vault', 'Hoboken', 'NJ', 40.75486, -74.03007),
  ('High Exposure', 'NORTHVALE', 'NJ', 41.01179, -73.94093),
  ('Method Climbing', 'Newark', 'NJ', 40.74301, -74.16861),
  ('Gravity Vault - Voorhees', 'Voorhees', 'NJ', 39.85331, -75.01316),
  ('Kinetic Climbing', 'Williamstown', 'NJ', 39.67115, -74.97645),
  ('Stone Age Climbing Gym - Midtown', 'Albuquerque', 'NM', 35.10535, -106.5998),
  ('Stone Age Climbing Gym - North', 'Albuquerque', 'NM', 35.18436, -106.57577),
  ('Santa Fe Climbing Center', 'Santa Fe', 'NM', 35.65338, -105.99239),
  ('GP81', 'Brooklyn', 'NY', 40.72646, -73.95807),
  ('MetroRock Brooklyn', 'Brooklyn', 'NY', 40.70806, -73.92034),
  ('Central Rock Gym - Buffalo', 'Buffalo', 'NY', 42.86949, -78.86847),
  ('Central Rock Gym - Manhattan', 'New York', 'NY', 40.77252, -73.99029),
  ('The Gravity Vault', 'Poughkeepsie', 'NY', 41.64395, -73.92508),
  ('Rocksport Climbing Gym', 'Queensbury', 'NY', 43.29321, -73.69197),
  ('Central Rock Gym - Rochester', 'Rochester', 'NY', 43.1499, -77.59448),
  ('Red Barn Climbing', 'Rochester', 'NY', 43.08455, -77.67195),
  ('RocVentures Climbing Gym', 'Rochester', 'NY', 43.15396, -77.57355),
  ('Central Rock Gym - Syracuse', 'Syracuse', 'NY', 43.05744, -76.15723),
  ('Cultivate Climbing (DOWNTOWN)', 'Asheville', 'NC', 35.59475, -82.55574),
  ('Cultivate Climbing (The River)', 'Asheville', 'NC', 35.56763, -82.56958),
  ('Inner Peaks Climbing Center - South End', 'Charlotte', 'NC', 35.2094, -80.86776),
  ('OC Aerial', 'Durham', 'NC', 36.03619, -78.98849),
  ('Triangle Rock Club - Durham', 'Durham', 'NC', 35.95086, -78.92508),
  ('Rock Solid Warrior', 'Fuquay Varina', 'NC', 35.59258, -78.75614),
  ('Ruckus Climbing Gym', 'Greensboro', 'NC', 36.01754, -79.8937),
  ('Inner Peaks Climbing Center - Matthews', 'Matthews', 'NC', 35.12059, -80.7057),
  ('Cliff HangersClimbing', 'Mooresville', 'NC', 35.59784, -80.85403),
  ('Bigfoot Climbing Gym', 'Morganton', 'NC', 35.74981, -81.68705),
  ('Triangle Rock Club - Morrisville', 'Morrisville', 'NC', 35.811, -78.82115),
  ('NCSU Carmichael Gym', 'Raleigh', 'NC', 35.78491, -78.67501),
  ('Triangle Rock Club Salvage Yard', 'Raleigh', 'NC', 35.81002, -78.6171),
  ('Wilmington Rock Gym', 'Wilmington', 'NC', 34.2427, -77.88982),
  ('Rock Mill Climbing', 'Akron', 'OH', 41.07543, -81.49782),
  ('Bloc Garten', 'Columbus', 'OH', 39.95045, -83.00797),
  ('Chambers Purely Boulders', 'Columbus', 'OH', 39.99318, -83.03889),
  ('Vertical Adventures Rock Climbing', 'Columbus', 'OH', 40.09489, -82.99379),
  ('Shaker Rocks', 'Shaker Heights', 'OH', 41.46789, -81.53561),
  ('Blocworks Climbing Community', 'Edmond', 'OK', 35.65399, -97.48123),
  ('Planet Granite Portland', 'Portland', 'OR', 45.53315, -122.68606),
  ('Kroc Center', 'Salem', 'OR', 44.97614, -123.00909),
  ('The Rock Boxx', 'Salem', 'OR', 44.89952, -123.00593),
  ('The Circuit Bouldering Gym (Tigard)', 'Tigard', 'OR', 45.40292, -122.75262),
  ('Reach Climbing Gym and Fitness Center', 'Bridgeport', 'PA', 40.10488, -75.33456),
  ('ASCEND Erie', 'Erie', 'PA', 42.13049, -80.08653),
  ('Spooky Nook Sports', 'Manheim', 'PA', 40.106, -76.41893),
  ('Philadelphia Rock Gyms - Fishtown', 'Philadelphia', 'PA', 39.97795, -75.12469),
  ('The Cliffs at Callowhill', 'Philadelphia', 'PA', 39.95863, -75.15535),
  ('Tufas Boulder Lounge', 'Philadelphia', 'PA', 39.97594, -75.14388),
  ('Ascend Pittsburgh', 'Pittsburgh', 'PA', 40.42618, -79.97555),
  ('FA Climbing & Fitness & Fitness', 'Pittsburgh', 'PA', 40.43297, -80.00455),
  ('Gravity Vault Radnor', 'Radnor', 'PA', 40.04493, -75.36013),
  ('The Gravity Vault Radnor', 'Radnor', 'PA', 40.04497, -75.36016),
  ('The Goat Fort', 'Warren', 'PA', 41.84223, -79.1452),
  ('Philadelphia Rock Gym - Wyncote', 'Wyncote', 'PA', 40.09692, -75.14435),
  ('BlocHaven', 'Greenville', 'SC', 34.8363, -82.42736),
  ('SDSU Climbing Gym', 'Brookings', 'SD', 44.32098, -96.78323),
  ('Black Hills Basecamp', 'Rapid City', 'SD', 44.11073, -103.17206),
  ('Frontier Climbing and Fitness', 'Sioux Falls', 'SD', 43.54483, -96.66383),
  ('Synergy Climbing and Ninja', 'Chattanooga', 'TN', 35.03519, -85.30202),
  ('The Crag - Franklin', 'Franklin', 'TN', 35.96112, -86.82898),
  ('Climb Murfreesboro', 'Murfreesboro', 'TN', 35.86607, -86.38699),
  ('The Crag - Nashville', 'Nashville', 'TN', 36.04527, -86.71564),
  ('Stone Co. Climbing', 'College Station', 'TX', 30.57025, -96.29535),
  ('InSPIRE Rock Climbing Gym', 'Cypress', 'TX', 29.95911, -95.71063),
  ('Siloville Climbing Gym', 'Hico', 'TX', 31.975, -98.03194),
  ('Momentum Silver Street', 'Houston', 'TX', 29.77119, -95.37774),
  ('InSpire Rock', 'Spring', 'TX', 30.07316, -95.4179),
  ('Momentum Indoor Climbing', 'Salt Lake City', 'UT', 40.69996, -111.85486),
  ('Movement Climbing, Yoga & Fitness (Formerly Earth Treks)', 'Arlington', 'VA', 38.86157, -77.05076),
  ('Rise Up Climbing', 'Lynchburg', 'VA', 37.41105, -79.14068),
  ('Peak Experiences - Midlothian', 'Midlothian', 'VA', 37.52608, -77.60977),
  ('Lattitude Climbing and Fitness', 'Norfolk', 'VA', 36.86589, -76.28062),
  ('Peak Experiences - Richmond', 'Richmond', 'VA', 37.56314, -77.4555),
  ('Edgeworks Climbing + Fitness - Bellevue', 'Bellevue', 'WA', 47.61988, -122.12871),
  ('Vital Climbing Gym', 'Bellingham', 'WA', 48.75028, -122.47488),
  ('Insight Climbing & Movement', 'Bremerton', 'WA', 47.56533, -122.64965),
  ('Summit Everett', 'Everett', 'WA', 47.98005, -122.21157),
  ('Climb San Juan', 'Friday Harbor', 'WA', 48.53322, -123.01745),
  ('Vertical World - North', 'Lynnwood', 'WA', 47.86881, -122.29807),
  ('Vertical World - Seattle', 'Seattle', 'WA', 47.661, -122.38671),
  ('Uplift Climbing', 'Shoreline', 'WA', 47.75482, -122.31435),
  ('Bloc Yard Bouldering Gym', 'Spokane', 'WA', 47.71928, -117.40637),
  ('High Steppe Climbing Center', 'Yakima', 'WA', 46.60844, -120.49733),
  ('Cairo Outdoors', 'Cairo', 'WV', 39.20618, -81.15713),
  ('Kress Events Center', 'Green Bay', 'WI', 44.53325, -87.92294),
  ('Boulders Climbing Gym - Downtown', 'Madison', 'WI', 43.07266, -89.38332),
  ('Summit Strength & Fitness', 'Madison', 'WI', 43.02978, -89.40142),
  ('The Sett Recreation', 'Madison', 'WI', 43.07221, -89.40864)
) AS c(name, city, state, lat, lng)
WHERE NOT EXISTS (
  SELECT 1 FROM gyms g WHERE g.status='approved'
    AND (111320 * sqrt(power(g.latitude - c.lat, 2)
         + power((g.longitude - c.lng) * cos(radians(c.lat)), 2))) <= 250
)
AND NOT EXISTS (
  SELECT 1 FROM gyms g WHERE g.status='approved'
    AND regexp_replace(lower(g.name),'[^a-z0-9]','','g') = regexp_replace(lower(c.name),'[^a-z0-9]','','g')
    AND lower(btrim(coalesce(g.city,''))) = lower(btrim(c.city))
);

-- Klimb gym de-duplication cleanup.
-- Appended to gym-import.sql so a fresh import can't leave duplicate map pins.
-- Two passes, both re-point user data (routes/home/visiting) before deleting:
--   1. Same physical place within 250 m, OR same name (accent-folded) whose
--      variant is a prefix of the other within 3 km  → merge (variants/rebrands).
--   2. Belt-and-suspenders exact-coincidence merge within 60 m.
-- Keeps the best-described row (has a city, longest name, oldest).

DO $$
BEGIN
  CREATE TEMP TABLE _lbl ON COMMIT DROP AS
  WITH RECURSIVE
    g AS (
      SELECT id, latitude AS la, longitude AS lo,
             regexp_replace(
               translate(lower(name),
                 'áàâäãåéèêëíìîïóòôöõúùûüñçß',
                 'aaaaaaeeeeiiiiooooouuuuncs'),
               '[^a-z0-9]', '', 'g') AS nk
      FROM gyms WHERE status='approved'
    ),
    dist AS (
      SELECT a.id AS a, b.id AS b, a.nk AS ank, b.nk AS bnk,
             (111320*sqrt(power(a.la-b.la,2)+power((a.lo-b.lo)*cos(radians(a.la)),2))) AS m
      FROM g a JOIN g b ON a.id <> b.id
        AND abs(a.la-b.la) < 0.03 AND abs(a.lo-b.lo) < 0.04
    ),
    edges AS (
      SELECT a, b FROM dist
      WHERE m <= 250
         OR ( m <= 3000 AND length(ank) >= 5 AND length(bnk) >= 5
              AND (ank = bnk OR ank LIKE bnk || '%' OR bnk LIKE ank || '%') )
    ),
    comp AS (
      SELECT id, id::text AS root FROM g
      UNION
      SELECT e.a, c.root FROM edges e JOIN comp c ON c.id = e.b
    )
  SELECT id, min(root) AS root FROM comp GROUP BY id;

  CREATE TEMP TABLE _keep ON COMMIT DROP AS
  SELECT DISTINCT ON (l.root) l.root, g.id AS keeper
  FROM _lbl l JOIN gyms g ON g.id = l.id
  ORDER BY l.root,
    (nullif(btrim(coalesce(g.city,'')),'') IS NOT NULL) DESC,
    length(g.name) DESC, g.created_at ASC, g.id ASC;

  CREATE TEMP TABLE _map ON COMMIT DROP AS
  SELECT l.id AS dup, k.keeper FROM _lbl l JOIN _keep k ON k.root = l.root
  WHERE l.id <> k.keeper;

  UPDATE routes r   SET gym_id=m.keeper          FROM _map m WHERE r.gym_id=m.dup;
  UPDATE profiles p SET home_gym_id=m.keeper     FROM _map m WHERE p.home_gym_id=m.dup;
  UPDATE profiles p SET visiting_gym_id=m.keeper FROM _map m WHERE p.visiting_gym_id=m.dup;
  DELETE FROM gyms g USING _map m WHERE g.id=m.dup;
END $$;

-- Sanity check — both should return 0.
SELECT
  (SELECT count(*) FROM (
     WITH g AS (SELECT id, latitude la, longitude lo FROM gyms WHERE status='approved')
     SELECT 1 FROM g a JOIN g b ON a.id<b.id
       AND (111320*sqrt(power(a.la-b.la,2)+power((a.lo-b.lo)*cos(radians(a.la)),2)))<=60) x
  ) AS overlapping_pairs;
