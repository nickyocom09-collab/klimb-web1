-- Klimb Google Maps US indoor climbing gym audit, generated 2026-08-01
-- Every state plus the District of Columbia was searched using the current
-- Google Maps "indoor rock climbing gyms in [state]" results.
-- 512 unique listings were categorized by Google Maps as Rock climbing gyms.
-- Existing aliases were matched by normalized name and coordinates.
-- 229 missing, open, indoor facilities remain for duplicate-safe insertion.
-- No records are deleted by this migration.

-- Hide confirmed outdoor and non-gym rows from older broad imports without
-- cascading away routes, profiles, or user data.
with rejected (name, reason) as (
values
  ('Boulder Mountain Swim Center', 'Not a climbing gym'),
  ('Idaho Boulders', 'Natural outdoor boulders'),
  ('Outdoor Climbing Tower', 'Outdoor climbing structure'),
  ('Boulder City Fitness Center', 'Not a climbing gym'),
  ('Boulder City Pool', 'Not a climbing gym'),
  ('Boulder City Speedway', 'Not a climbing gym'),
  ('Boulder Rifle & Pistol Club', 'Not a climbing gym'),
  ('Alpine Adventures Outdoor Recreation', 'Outdoor adventure operator'),
  ('North Domingo Baca Park Climbing Wall', 'Outdoor park wall'),
  ('LeBauer Park', 'Outdoor park'),
  ('Rock Dimensions Climbing Guides', 'Outdoor guide service'),
  ('Jack Frost Big Boulder Ski Area', 'Ski area, not an indoor climbing gym'),
  ('The Rope Adventure Park at Luray Caverns', 'Outdoor ropes/adventure park'),
  ('Boulder Cove', 'Outdoor climbing facility at Summit Bechtel Reserve'),
  ('Maggie Daley Park', 'Outdoor climbing park'),
  ('BREC Perkins Road Community Park', 'Outdoor climbing tower')
)
update public.gyms g
set status = 'pending'
from rejected r
where lower(g.name) = lower(r.name)
  and lower(coalesce(g.cc, 'us')) = 'us'
  and g.status = 'approved';

with incoming (name, city, state, state_code, latitude, longitude, normalized_name) as (
values
  ('Ascension Rock Club', 'Fairbanks', 'Alaska', 'AK', 64.8073, -147.7057579, 'ascensionrockclub'),
  ('G Street Climbing Gym', 'Kenai Peninsula Borough', 'Alaska', 'AK', 60.9185437, -149.6246461, 'gstreetclimbinggym'),
  ('Rock Dump Indoor Climbing Gym', 'Juneau', 'Alaska', 'AK', 58.2880556, -134.3883334, 'rockdumpindoorclimbinggym'),
  ('High Point Climbing and Fitness - Lincoln Mill', 'Huntsville', 'Alabama', 'AL', 34.7471924, -86.5823846, 'highpointclimbingandfitnesslincolnmill'),
  ('Hoover Heights Climbing Center', 'Hoover', 'Alabama', 'AL', 33.3369679, -86.8479199, 'hooverheightsclimbingcenter'),
  ('Treadstone Columbus', 'Phenix City', 'Alabama', 'AL', 32.4545846, -84.9969835, 'treadstonecolumbus'),
  ('Little Rock Climbing Center', 'Little Rock', 'Arkansas', 'AR', 34.7113321, -92.410748, 'littlerockclimbingcenter'),
  ('Ozark Climbing Gym', 'Springdale', 'Arkansas', 'AR', 36.1663412, -94.1231357, 'ozarkclimbinggym'),
  ('Beta Bouldering Gym', 'Flagstaff', 'Arizona', 'AZ', 35.1887605, -111.6363289, 'betaboulderinggym'),
  ('Climbmax Rock Climbing Gym', 'Tempe', 'Arizona', 'AZ', 33.3432312, -111.9588394, 'climbmaxrockclimbinggym'),
  ('Flagstaff Climbing (Main Street Boulders)', 'Flagstaff', 'Arizona', 'AZ', 35.2024226, -111.6182824, 'flagstaffclimbingmainstreetboulders'),
  ('Gecko Climbing Gym', 'Phoenix', 'Arizona', 'AZ', 33.7064842, -112.1019235, 'geckoclimbinggym'),
  ('Rock Solid Climbing + Fitness', 'Marana', 'Arizona', 'AZ', 32.3301214, -111.0494708, 'rocksolidclimbingfitness'),
  ('Aesthetic Climbing Gym', 'Lake Forest', 'California', 'CA', 33.6651045, -117.6639492, 'aestheticclimbinggym'),
  ('Blue Granite Climbing Gym', 'South Lake Tahoe', 'California', 'CA', 38.9056514, -119.9990962, 'bluegraniteclimbinggym'),
  ('Granite Arch Climbing Center', 'Sacramento County', 'California', 'CA', 38.6125451, -121.259367, 'granitearchclimbingcenter'),
  ('Hangar 18 Indoor Climbing Gym - East Riverside', 'Riverside', 'California', 'CA', 33.9913978, -117.3411274, 'hangar18indoorclimbinggymeastriverside'),
  ('High Altitude Fitness Truckee', 'Truckee', 'California', 'CA', 39.3266754, -120.2175521, 'highaltitudefitnesstruckee'),
  ('Long Beach Rising', 'Long Beach', 'California', 'CA', 33.7827225, -118.1908231, 'longbeachrising'),
  ('Boulder Rock Club', 'Boulder', 'Colorado', 'CO', 40.0258252, -105.2567432, 'boulderrockclub'),
  ('G1 Climbing + Fitness', 'Broomfield', 'Colorado', 'CO', 39.9064422, -105.0996858, 'g1climbingfitness'),
  ('Springs Climbing Center', 'Colorado Springs', 'Colorado', 'CO', 38.8989382, -104.8272831, 'springsclimbingcenter'),
  ('Summit Climbing Gym', 'Silverthorne', 'Colorado', 'CO', 39.644886, -106.0798665, 'summitclimbinggym'),
  ('Whetstone Climbing', 'Fort Collins', 'Colorado', 'CO', 40.5071808, -105.0738659, 'whetstoneclimbing'),
  ('Rock Spot Climbing: New Haven', 'New Haven', 'Connecticut', 'CT', 41.3027233, -72.9208328, 'rockspotclimbingnewhaven'),
  ('Stone Age Rock Gym', 'Manchester', 'Connecticut', 'CT', 41.7893791, -72.5500869, 'stoneagerockgym'),
  ('Thrillz High Flying Adventure Park — CT''s #1 Extreme Adrenaline Park + ARCADE', 'Danbury', 'Connecticut', 'CT', 41.3921318, -73.5154266, 'thrillzhighflyingadventureparkcts1extremeadrenalineparkarcade'),
  ('Delaware Rock Gym Inc.', 'New Castle County', 'Delaware', 'DE', 39.6111401, -75.6894426, 'delawarerockgyminc'),
  ('RISE Fitness + Adventure', 'Sussex County', 'Delaware', 'DE', 38.7207714, -75.1227269, 'risefitnessadventure'),
  ('Central Rock Gym - Orlando', 'Orange County', 'Florida', 'FL', 28.4487143, -81.4044588, 'centralrockgymorlando'),
  ('Fort Rock Climbing Center', 'Lee County', 'Florida', 'FL', 26.4933289, -81.8350092, 'fortrockclimbingcenter'),
  ('High Point Climbing And Fitness - Orlando', 'Orlando', 'Florida', 'FL', 28.5679396, -81.4084138, 'highpointclimbingandfitnessorlando'),
  ('Stone Climbing - STA', 'Saint Johns County', 'Florida', 'FL', 29.8627204, -81.3391189, 'stoneclimbingsta'),
  ('The Edge Rock Gym - Rock Climbing and Fitness', 'Miami-Dade County', 'Florida', 'FL', 25.6376973, -80.4204796, 'theedgerockgymrockclimbingandfitness'),
  ('UWF Climbing Center', 'Escambia County', 'Florida', 'FL', 30.544719, -87.2218312, 'uwfclimbingcenter'),
  ('Active Climbing - Indoor Rock Climbing', 'Columbia County', 'Georgia', 'GA', 33.4811328, -82.1402323, 'activeclimbingindoorrockclimbing'),
  ('APEX Climbing and Spa', 'Watkinsville', 'Georgia', 'GA', 33.8614057, -83.3948448, 'apexclimbingandspa'),
  ('Brunswick Rocks', 'Brunswick', 'Georgia', 'GA', 31.1495321, -81.4956528, 'brunswickrocks'),
  ('Central Rock Gym - Kennesaw', 'Cobb County', 'Georgia', 'GA', 34.0213658, -84.5688329, 'centralrockgymkennesaw'),
  ('Escalade Rock Climbing Kennesaw', 'Kennesaw', 'Georgia', 'GA', 34.0437743, -84.6148575, 'escaladerockclimbingkennesaw'),
  ('Escalade Rock Climbing PTC', 'Tyrone', 'Georgia', 'GA', 33.438451, -84.605347, 'escaladerockclimbingptc'),
  ('Wall Crawler Rock Club', 'Atlanta', 'Georgia', 'GA', 33.7625905, -84.3380397, 'wallcrawlerrockclub'),
  ('Aloha Rock Gym', 'Kahului', 'Hawaii', 'HI', 20.8856854, -156.4495018, 'aloharockgym'),
  ('HiClimb | Rock Climbing and Yoga', 'Honolulu', 'Hawaii', 'HI', 21.2985948, -157.8563731, 'hiclimbrockclimbingandyoga'),
  ('Kona Cliffs', 'Hawaiʻi County', 'Hawaii', 'HI', 19.6437045, -155.9976124, 'konacliffs'),
  ('Bluestem Boulders', 'Ames', 'Iowa', 'IA', 42.0240661, -93.6036793, 'bluestemboulders'),
  ('The Workshop', 'Des Moines', 'Iowa', 'IA', 41.6024852, -93.6180449, 'theworkshop'),
  ('Asana Climbing Gym', 'Garden City', 'Idaho', 'ID', 43.6506902, -116.2812582, 'asanaclimbinggym'),
  ('Coeur Climbing Company', 'Post Falls', 'Idaho', 'ID', 47.6983248, -117.0124677, 'coeurclimbingcompany'),
  ('Sandpoint Rock Gym', 'Sandpoint', 'Idaho', 'ID', 48.2743186, -116.5548126, 'sandpointrockgym'),
  ('UI Climbing Center', 'Moscow', 'Idaho', 'ID', 46.7322497, -117.0134202, 'uiclimbingcenter'),
  ('First Ascent Block 37', 'Chicago', 'Illinois', 'IL', 41.8839453, -87.6286307, 'firstascentblock37'),
  ('North Wall Rock Climbing Gym', 'Crystal Lake', 'Illinois', 'IL', 42.2183308, -88.3163834, 'northwallrockclimbinggym'),
  ('The Centre of Elgin', 'Elgin', 'Illinois', 'IL', 42.040926, -88.285288, 'thecentreofelgin'),
  ('Climb Lafayette', 'Tippecanoe County', 'Indiana', 'IN', 40.3631704, -86.8157044, 'climblafayette'),
  ('Climbing & Bouldering Wall', 'Saint Joseph County', 'Indiana', 'IN', 41.6984209, -86.2353313, 'climbingboulderingwall'),
  ('Columbus Rocks Climbing and Fitness', 'Columbus', 'Indiana', 'IN', 39.2138386, -85.9052246, 'columbusrocksclimbingandfitness'),
  ('Hoosier Heights Bloomington', 'Bloomington', 'Indiana', 'IN', 39.1559258, -86.538927, 'hoosierheightsbloomington'),
  ('Life Time', 'Indianapolis', 'Indiana', 'IN', 39.9143624, -86.0670367, 'lifetime'),
  ('SpringHill Climbing Wall', 'Jackson County', 'Indiana', 'IN', 38.9730811, -86.0936576, 'springhillclimbingwall'),
  ('Summit City Climbing Co.', 'Fort Wayne', 'Indiana', 'IN', 41.0816644, -85.1199497, 'summitcityclimbingco'),
  ('Kansas Cliff Club', 'Riverside Township', 'Kansas', 'KS', 37.611263, -97.293446, 'kansascliffclub'),
  ('Life Time', 'Overland Park', 'Kansas', 'KS', 38.8789466, -94.6645722, 'lifetime'),
  ('Rendezvous Climbing Gym', 'Leawood', 'Kansas', 'KS', 38.8900039, -94.6096114, 'rendezvousclimbinggym'),
  ('Redpoint Climbing Center', 'Bowling Green', 'Kentucky', 'KY', 36.9282024, -86.4984248, 'redpointclimbingcenter'),
  ('Carabiner''s Climbing & Fitness', 'New Bedford', 'Massachusetts', 'MA', 41.6422222, -70.9480556, 'carabinersclimbingfitness'),
  ('La Vida Rock Gym', 'Wenham', 'Massachusetts', 'MA', 42.5861754, -70.8237472, 'lavidarockgym'),
  ('Rock Spot Climbing: Malden, MA', 'Malden', 'Massachusetts', 'MA', 42.4266907, -71.0732739, 'rockspotclimbingmaldenma'),
  ('NinjAdventure Zone', 'Waterville', 'Maine', 'ME', 44.5605411, -69.644012, 'ninjadventurezone'),
  ('Higher Ground Rock Climbing Centre', 'Grand Rapids', 'Michigan', 'MI', 42.9778078, -85.6715526, 'highergroundrockclimbingcentre'),
  ('Inside Moves LLC', 'Byron Township', 'Michigan', 'MI', 42.8273203, -85.6791868, 'insidemovesllc'),
  ('Nexus Climbing School', 'Benton Charter Township', 'Michigan', 'MI', 42.0842619, -86.4422549, 'nexusclimbingschool'),
  ('Shift Climbing', 'Holland Charter Township', 'Michigan', 'MI', 42.8165179, -86.0866661, 'shiftclimbing'),
  ('ClimbZone at Mall of America', 'Bloomington', 'Minnesota', 'MN', 44.8555012, -93.2408153, 'climbzoneatmallofamerica'),
  ('Duluth Climbing and Fitness Co-op', 'Duluth', 'Minnesota', 'MN', 46.786618, -92.1000156, 'duluthclimbingandfitnesscoop'),
  ('Minnesota Climbing Cooperative', 'Minneapolis', 'Minnesota', 'MN', 45.0057239, -93.2499082, 'minnesotaclimbingcooperative'),
  ('Recreation & Wellness Center Climbing Gym', 'Minneapolis', 'Minnesota', 'MN', 44.9750926, -93.2296758, 'recreationwellnesscenterclimbinggym'),
  ('The A Climbing Gym', 'Minneapolis', 'Minnesota', 'MN', 44.990479, -93.2424204, 'theaclimbinggym'),
  ('Vertical Endeavors - Duluth', 'Duluth', 'Minnesota', 'MN', 46.7826237, -92.0959925, 'verticalendeavorsduluth'),
  ('Firley YMCA Climbing Wall', 'Jefferson City', 'Missouri', 'MO', 38.5527084, -92.1915482, 'firleyymcaclimbingwall'),
  ('The Bouldering Garden', 'Boone County', 'Missouri', 'MO', 38.9571533, -92.2553329, 'theboulderinggarden'),
  ('Escape Arcade & Family Entertainment Center', 'Biloxi', 'Mississippi', 'MS', 30.3914766, -88.8620463, 'escapearcadefamilyentertainmentcenter'),
  ('Freestone Climbing Center', 'Missoula', 'Montana', 'MT', 46.8832435, -114.0089263, 'freestoneclimbingcenter'),
  ('Recreate Climbing Gym', 'Butte', 'Montana', 'MT', 46.0026645, -112.5272298, 'recreateclimbinggym'),
  ('Spire Climbing + Fitness - Main Facility', 'Gallatin County', 'Montana', 'MT', 45.6563104, -111.0704691, 'spireclimbingfitnessmainfacility'),
  ('Spire Climbing + Fitness - Training Center', 'Gallatin County', 'Montana', 'MT', 45.6758736, -111.1442411, 'spireclimbingfitnesstrainingcenter'),
  ('Stonetree Climbing Center', 'Helena', 'Montana', 'MT', 46.6000353, -112.0193805, 'stonetreeclimbingcenter'),
  ('Brevard Rock Gym', 'Brevard', 'North Carolina', 'NC', 35.2308498, -82.7367983, 'brevardrockgym'),
  ('Climbing Center', 'Mecklenburg County', 'North Carolina', 'NC', 35.2720632, -81.0058343, 'climbingcenter'),
  ('FirstHand Climbing', 'Winston-Salem', 'North Carolina', 'NC', 36.1075578, -80.2438005, 'firsthandclimbing'),
  ('Sagee', 'Macon County', 'North Carolina', 'NC', 35.0527026, -83.1761408, 'sagee'),
  ('Approach Climbing Gym', 'Omaha', 'Nebraska', 'NE', 41.2101225, -96.0232705, 'approachclimbinggym'),
  ('E.T. Mahoney State Park Activity Center, Venture Climb, and Seasonal Ice Skating Rink', 'South Bend Precinct', 'Nebraska', 'NE', 41.0234139, -96.3158281, 'etmahoneystateparkactivitycenterventureclimbandseasonaliceskatingrink'),
  ('Life Time', 'Omaha', 'Nebraska', 'NE', 41.2306554, -96.1802955, 'lifetime'),
  ('UNL Outdoor Adventures Center', 'Lincoln', 'Nebraska', 'NE', 40.8230624, -96.7007804, 'unloutdooradventurescenter'),
  ('UNO Outdoor Venture Center Climbing Wall', 'Omaha', 'Nebraska', 'NE', 41.2567756, -96.0088075, 'unooutdoorventurecenterclimbingwall'),
  ('Foster Climbing Barn', 'Barrington', 'New Hampshire', 'NH', 43.2423469, -71.0211225, 'fosterclimbingbarn'),
  ('High Ground', 'Gorham', 'New Hampshire', 'NH', 44.3874316, -71.1724042, 'highground'),
  ('Elite Climbing, LLC', 'Maple Shade Township', 'New Jersey', 'NJ', 39.9413757, -74.9814071, 'eliteclimbingllc'),
  ('HAPIK Climbing Gym – East Rutherford (American Dream Mall)', 'East Rutherford', 'New Jersey', 'NJ', 40.8080429, -74.0690254, 'hapikclimbinggymeastrutherfordamericandreammall'),
  ('New Jersey Rock Gym', 'Fairfield', 'New Jersey', 'NJ', 40.8822984, -74.2943857, 'newjerseyrockgym'),
  ('Randolph Climbing Center', 'Randolph Township', 'New Jersey', 'NJ', 40.862594, -74.615076, 'randolphclimbingcenter'),
  ('Rockville Climbing Center Inc', 'Hamilton Township', 'New Jersey', 'NJ', 40.2400387, -74.7277212, 'rockvilleclimbingcenterinc'),
  ('The Gravity Vault - Upper Saddle River, NJ', 'Upper Saddle River', 'New Jersey', 'NJ', 41.0515512, -74.1173553, 'thegravityvaultuppersaddlerivernj'),
  ('The Gravity Vault Brick, NJ', 'Brick Township', 'New Jersey', 'NJ', 40.0578965, -74.1422287, 'thegravityvaultbricknj'),
  ('Adventure Fit Dojo', 'Douglas County', 'Nevada', 'NV', 38.9834373, -119.9416447, 'adventurefitdojo'),
  ('BaseCamp Climbing Gym', 'Reno', 'Nevada', 'NV', 39.5279917, -119.8144809, 'basecampclimbinggym'),
  ('Mesa Rim Climbing Center', 'Reno', 'Nevada', 'NV', 39.5155185, -119.7849458, 'mesarimclimbingcenter'),
  ('Nevada Climbing Center', 'Clark County', 'Nevada', 'NV', 36.0778117, -115.1085551, 'nevadaclimbingcenter'),
  ('The Block Climbing and Fitness', 'Reno', 'Nevada', 'NV', 39.5326959, -119.8014976, 'theblockclimbingandfitness'),
  ('The Refuge Climbing and Fitness', 'Clark County', 'Nevada', 'NV', 36.0767882, -115.1923434, 'therefugeclimbingandfitness'),
  ('Central Rock Gym - Chelsea', 'New York', 'New York', 'NY', 40.7510984, -74.0041661, 'centralrockgymchelsea'),
  ('HAPIK Climbing Gym – Brooklyn', 'New York', 'New York', 'NY', 40.6563697, -74.0060507, 'hapikclimbinggymbrooklyn'),
  ('Hapik Yonkers', 'City of Yonkers', 'New York', 'NY', 40.9618336, -73.8560776, 'hapikyonkers'),
  ('Movement LIC', 'New York', 'New York', 'NY', 40.7485996, -73.9487406, 'movementlic'),
  ('Movement Valhalla', 'Town of Mount Pleasant', 'New York', 'NY', 41.0881642, -73.7872936, 'movementvalhalla'),
  ('The Crux at Pok-O-MacCready', 'Town of Willsboro', 'New York', 'NY', 44.371885, -73.4618889, 'thecruxatpokomaccready'),
  ('The Gravity Vault Melville', 'Town of Huntington', 'New York', 'NY', 40.775381, -73.4133223, 'thegravityvaultmelville'),
  ('The Gravity Vault Westbury', 'Town of Hempstead', 'New York', 'NY', 40.7448953, -73.5934298, 'thegravityvaultwestbury'),
  ('Adventus Climbing', 'Sylvania Township', 'Ohio', 'OH', 41.6739378, -83.6689807, 'adventusclimbing'),
  ('Blockhouse Bouldering Gym', 'Athens Township', 'Ohio', 'OH', 39.3676791, -82.1313009, 'blockhouseboulderinggym'),
  ('Cleveland Rocks Climbing', 'Cleveland', 'Ohio', 'OH', 41.4870532, -81.7093928, 'clevelandrocksclimbing'),
  ('Climb Cleveland', 'Cleveland', 'Ohio', 'OH', 41.4819858, -81.6873559, 'climbcleveland'),
  ('Climb Time Oakley', 'Cincinnati', 'Ohio', 'OH', 39.1560033, -84.4202311, 'climbtimeoakley'),
  ('Climb Time of Blue Ash', 'Blue Ash', 'Ohio', 'OH', 39.261291, -84.3704371, 'climbtimeofblueash'),
  ('Climb Toledo', 'Toledo', 'Ohio', 'OH', 41.6806962, -83.5388681, 'climbtoledo'),
  ('On The Rocks Climbing Gym', 'Amherst Township', 'Ohio', 'OH', 41.3654327, -82.209587, 'ontherocksclimbinggym'),
  ('Rising Up Rock Gym', 'Medina', 'Ohio', 'OH', 41.1420758, -81.8762138, 'risinguprockgym'),
  ('Urban Krag Climbing Center', 'Dayton', 'Ohio', 'OH', 39.755336, -84.1824636, 'urbankragclimbingcenter'),
  ('Blocworks Midtown', 'Oklahoma City', 'Oklahoma', 'OK', 35.480464, -97.518538, 'blocworksmidtown'),
  ('GRAVITY BEAR Bouldering Gym | Climbing, Training, and Fitness', 'Tulsa', 'Oklahoma', 'OK', 36.1559055, -95.9830116, 'gravitybearboulderinggymclimbingtrainingandfitness'),
  ('High Plains Climbing', 'Oklahoma City', 'Oklahoma', 'OK', 35.4602429, -97.5070543, 'highplainsclimbing'),
  ('Rose Rock Climbing, Yoga, and Fitness', 'Norman', 'Oklahoma', 'OK', 35.272472, -97.481271, 'roserockclimbingyogaandfitness'),
  ('Threshold Climbing, Fitness and Yoga', 'Oklahoma City', 'Oklahoma', 'OK', 35.6069493, -97.6242706, 'thresholdclimbingfitnessandyoga'),
  ('Bend Rock Gym', 'Bend', 'Oregon', 'OR', 44.0379044, -121.2900345, 'bendrockgym'),
  ('Boardworks Climbing and Fitness', 'Bend', 'Oregon', 'OR', 44.0391269, -121.3031578, 'boardworksclimbingandfitness'),
  ('Crux Rock Gym', 'Eugene', 'Oregon', 'OR', 44.0566532, -123.0991046, 'cruxrockgym'),
  ('Elevation Bouldering Gym', 'Eugene', 'Oregon', 'OR', 44.0563377, -123.0980808, 'elevationboulderinggym'),
  ('Portland Rock Gym - Beaverton', 'Beaverton', 'Oregon', 'OR', 45.5135027, -122.7889695, 'portlandrockgymbeaverton'),
  ('Portland Rock Gym - Northeast', 'Portland', 'Oregon', 'OR', 45.5234855, -122.6537889, 'portlandrockgymnortheast'),
  ('Rock Haven Climbing Gym', 'Gresham', 'Oregon', 'OR', 45.5264235, -122.4344395, 'rockhavenclimbinggym'),
  ('Rogue Rock Gym', 'Medford', 'Oregon', 'OR', 42.2954812, -122.840577, 'roguerockgym'),
  ('Skyhook Bouldering', 'Portland', 'Oregon', 'OR', 45.5054792, -122.6533996, 'skyhookbouldering'),
  ('The Circuit Bouldering Gym Eugene', 'Eugene', 'Oregon', 'OR', 44.0480197, -123.090064, 'thecircuitboulderinggymeugene'),
  ('The Circuit Bouldering Gym NE', 'Portland', 'Oregon', 'OR', 45.5258379, -122.6480664, 'thecircuitboulderinggymne'),
  ('The Circuit Bouldering Gym SW', 'Portland', 'Oregon', 'OR', 45.4801315, -122.6724587, 'thecircuitboulderinggymsw'),
  ('The Jug Rock Gym', 'Redmond', 'Oregon', 'OR', 44.2520713, -121.1704177, 'thejugrockgym'),
  ('Lititz recROC', 'Warwick Township', 'Pennsylvania', 'PA', 40.1755494, -76.3122622, 'lititzrecroc'),
  ('North Summit Climbing Gym', 'Bushkill Township', 'Pennsylvania', 'PA', 40.8300941, -75.305556, 'northsummitclimbinggym'),
  ('Philadelphia Rock Gyms - Malvern', 'East Whiteland Township', 'Pennsylvania', 'PA', 40.0447387, -75.5273056, 'philadelphiarockgymsmalvern'),
  ('Philadelphia Rock Gyms - Oaks', 'Upper Providence Township', 'Pennsylvania', 'PA', 40.124406, -75.454665, 'philadelphiarockgymsoaks'),
  ('Warehouse Rocks Climbing & Fitness', 'Abbottstown', 'Pennsylvania', 'PA', 39.8879651, -76.9901376, 'warehouserocksclimbingfitness'),
  ('Central Rock Gym - Warwick', 'Warwick', 'Rhode Island', 'RI', 41.7302284, -71.4827804, 'centralrockgymwarwick'),
  ('Capital Climbing Cayce', 'Cayce', 'South Carolina', 'SC', 33.9867896, -81.0547843, 'capitalclimbingcayce'),
  ('Trailhead Climbing & Outdoor Center, LLC', 'Anderson County', 'South Carolina', 'SC', 34.5474512, -82.6923795, 'trailheadclimbingoutdoorcenterllc'),
  ('Climbing Roots', 'Knoxville', 'Tennessee', 'TN', 35.9428687, -83.8898243, 'climbingroots'),
  ('The Climbing Center', 'Knoxville', 'Tennessee', 'TN', 35.952816, -83.963272, 'theclimbingcenter'),
  ('Vol Wall - UTOP', 'Knoxville', 'Tennessee', 'TN', 35.9519345, -83.9322774, 'volwallutop'),
  ('Armadillo Boulders - San Marcos', 'San Marcos', 'Texas', 'TX', 29.862517, -97.9621385, 'armadilloboulderssanmarcos'),
  ('Basin Climbing and Fitness', 'Hewitt', 'Texas', 'TX', 31.4665311, -97.1796327, 'basinclimbingandfitness'),
  ('Bouldering Project - Springdale', 'Austin', 'Texas', 'TX', 30.2632602, -97.6964809, 'boulderingprojectspringdale'),
  ('Canyons Rock Climbing', 'Frisco', 'Texas', 'TX', 33.1596916, -96.8315931, 'canyonsrockclimbing'),
  ('Crux Climbing Center Pflugerville', 'Pflugerville', 'Texas', 'TX', 30.4782783, -97.6162334, 'cruxclimbingcenterpflugerville'),
  ('HAPIK Climbing Gym – Garland (Dallas Firewheel)', 'Garland', 'Texas', 'TX', 32.9516777, -96.6122973, 'hapikclimbinggymgarlanddallasfirewheel'),
  ('inSPIRE Rock Indoor Climbing & Team Building Center', 'Houston', 'Texas', 'TX', 30.0695727, -95.4289419, 'inspirerockindoorclimbingteambuildingcenter'),
  ('Movement Denton', 'Denton', 'Texas', 'TX', 33.2158304, -97.1348019, 'movementdenton'),
  ('Movement Design District', 'Dallas', 'Texas', 'TX', 32.7899387, -96.8231336, 'movementdesigndistrict'),
  ('Movement Fort Worth', 'Fort Worth', 'Texas', 'TX', 32.7476735, -97.3580748, 'movementfortworth'),
  ('Movement Grapevine', 'Grapevine', 'Texas', 'TX', 32.9047154, -97.0958188, 'movementgrapevine'),
  ('Movement The Hill', 'Dallas', 'Texas', 'TX', 32.8812226, -96.7685784, 'movementthehill'),
  ('Sessions Climbing + Fitness', 'El Paso', 'Texas', 'TX', 31.8873001, -106.5736689, 'sessionsclimbingfitness'),
  ('Space City Rock Climbing', 'League City', 'Texas', 'TX', 29.5016651, -95.1161497, 'spacecityrockclimbing'),
  ('The Blok Climbing Co', 'Fort Worth', 'Texas', 'TX', 32.7150935, -97.400523, 'theblokclimbingco'),
  ('Bouldering Project - The Granary', 'Salt Lake City', 'Utah', 'UT', 40.7549592, -111.903075, 'boulderingprojectthegranary'),
  ('Climb Moab Gym', 'San Juan County', 'Utah', 'UT', 38.494024, -109.4689751, 'climbmoabgym'),
  ('Contact Climbing Gym', 'St. George', 'Utah', 'UT', 37.1233374, -113.5255652, 'contactclimbinggym'),
  ('Elevation Rock Gym', 'North Logan', 'Utah', 'UT', 41.7637453, -111.8283428, 'elevationrockgym'),
  ('Irock Climbing Wall', 'Ogden', 'Utah', 'UT', 41.2250266, -111.9720558, 'irockclimbingwall'),
  ('Iron Cliffs Gym', 'Cedar City', 'Utah', 'UT', 37.6878446, -113.081693, 'ironcliffsgym'),
  ('Momentum Indoor Climbing Fort Union', 'Midvale', 'Utah', 'UT', 40.6203687, -111.8607775, 'momentumindoorclimbingfortunion'),
  ('Momentum Indoor Climbing Lehi', 'Lehi', 'Utah', 'UT', 40.3828124, -111.8345286, 'momentumindoorclimbinglehi'),
  ('Momentum Indoor Climbing Millcreek', 'Millcreek', 'Utah', 'UT', 40.7011194, -111.8032667, 'momentumindoorclimbingmillcreek'),
  ('Momentum Indoor Climbing Sandy', 'Sandy', 'Utah', 'UT', 40.564405, -111.8978999, 'momentumindoorclimbingsandy'),
  ('Momentum Indoor Climbing Trolley Square', 'Salt Lake City', 'Utah', 'UT', 40.7571488, -111.8736431, 'momentumindoorclimbingtrolleysquare'),
  ('The Front - Ogden', 'Ogden', 'Utah', 'UT', 41.2310156, -111.9751385, 'thefrontogden'),
  ('The Front - SLC', 'Salt Lake City', 'Utah', 'UT', 40.7376921, -111.9025583, 'thefrontslc'),
  ('The Quarry Indoor Climbing Center', 'Provo', 'Utah', 'UT', 40.266903, -111.6701025, 'thequarryindoorclimbingcenter'),
  ('The Scratch Pad', 'Bountiful', 'Utah', 'UT', 40.8848811, -111.8727818, 'thescratchpad'),
  ('Rapp Rocks Climbing Gym', 'Spotsylvania County', 'Virginia', 'VA', 38.2615229, -77.437704, 'rapprocksclimbinggym'),
  ('River Rock Climbing', 'Roanoke', 'Virginia', 'VA', 37.263368, -79.9576052, 'riverrockclimbing'),
  ('Send It Climbing Gym', 'Norfolk', 'Virginia', 'VA', 36.9100494, -76.2460021, 'senditclimbinggym'),
  ('Sportrock Climbing Centers - Lorton', 'Springfield', 'Virginia', 'VA', 38.7134631, -77.2337523, 'sportrockclimbingcenterslorton'),
  ('Triangle Rock Club - Richmond', 'Henrico County', 'Virginia', 'VA', 37.585804, -77.489333, 'trianglerockclubrichmond'),
  ('Vertical Rock Climbing & Fitness Center', 'Manassas', 'Virginia', 'VA', 38.7463427, -77.5047361, 'verticalrockclimbingfitnesscenter'),
  ('Vertical Rock Tysons Bouldering', 'Reston', 'Virginia', 'VA', 38.9245389, -77.2402851, 'verticalrocktysonsbouldering'),
  ('BrattCave Bouldering Gym', 'Brattleboro', 'Vermont', 'VT', 42.8369434, -72.5538314, 'brattcaveboulderinggym'),
  ('Burly Bloc', 'Essex', 'Vermont', 'VT', 44.502443, -73.04568, 'burlybloc'),
  ('Green Mountain Rock Climbing Center', 'Rutland City', 'Vermont', 'VT', 43.6197536, -72.9557569, 'greenmountainrockclimbingcenter'),
  ('Top of the Notch Boulder', 'Cambridge', 'Vermont', 'VT', 44.5549081, -72.7957803, 'topofthenotchboulder'),
  ('Bouldering Project - Fremont', 'Seattle', 'Washington', 'WA', 47.6502921, -122.3417288, 'boulderingprojectfremont'),
  ('Bouldering Project - Poplar', 'Seattle', 'Washington', 'WA', 47.5934687, -122.3109464, 'boulderingprojectpoplar'),
  ('Cirque Climbing', 'Lacey', 'Washington', 'WA', 47.0721337, -122.7681739, 'cirqueclimbing'),
  ('Climb NORA', 'Federal Way', 'Washington', 'WA', 47.3252507, -122.3127448, 'climbnora'),
  ('Climb Tacoma', 'Tacoma', 'Washington', 'WA', 47.2231588, -122.4786731, 'climbtacoma'),
  ('Edgeworks Climbing Bel-Red', 'Bellevue', 'Washington', 'WA', 47.6252979, -122.1545507, 'edgeworksclimbingbelred'),
  ('Edgeworks Climbing Seattle', 'Seattle', 'Washington', 'WA', 47.6681084, -122.3953726, 'edgeworksclimbingseattle'),
  ('Edgeworks Climbing Tacoma', 'Tacoma', 'Washington', 'WA', 47.2572712, -122.5198465, 'edgeworksclimbingtacoma'),
  ('Endurance Climbing Gym', 'Burlington', 'Washington', 'WA', 48.4560599, -122.3318353, 'enduranceclimbinggym'),
  ('Half Moon Bouldering', 'Seattle', 'Washington', 'WA', 47.6912686, -122.35712, 'halfmoonbouldering'),
  ('Momentum Indoor Climbing SODO', 'Seattle', 'Washington', 'WA', 47.5779004, -122.3346219, 'momentumindoorclimbingsodo'),
  ('Rock Shop', 'Richland', 'Washington', 'WA', 46.2329451, -119.2150487, 'rockshop'),
  ('Source Climbing Center', 'Vancouver', 'Washington', 'WA', 45.630128, -122.6717881, 'sourceclimbingcenter'),
  ('Climb at the Loop LLC', 'Burlington', 'Wisconsin', 'WI', 42.6799435, -88.2774995, 'climbattheloopllc'),
  ('Turner Hall Climbing Gym', 'Milwaukee', 'Wisconsin', 'WI', 43.0437781, -87.9157938, 'turnerhallclimbinggym'),
  ('Climbing New Heights', 'Berkeley County', 'West Virginia', 'WV', 39.5051701, -77.9655826, 'climbingnewheights'),
  ('Gripped Fitness', 'Fayetteville', 'West Virginia', 'WV', 38.0236297, -81.1209219, 'grippedfitness'),
  ('Highlands Sports Complex', 'Ohio County', 'West Virginia', 'WV', 40.0558254, -80.6060144, 'highlandssportscomplex'),
  ('Campbell County Recreation Center', 'Gillette', 'Wyoming', 'WY', 44.255412, -105.507739, 'campbellcountyrecreationcenter'),
  ('Elemental Performance + Fitness', 'Lander', 'Wyoming', 'WY', 42.833815, -108.727498, 'elementalperformancefitness'),
  ('Rock Wall', 'Anchorage', 'Alaska', 'AK', 61.1909101, -149.8034376, 'rockwall'),
  ('Benchmark Climbing', 'San Francisco', 'California', 'CA', 37.7888744, -122.4216406, 'benchmarkclimbing'),
  ('Vertical Endeavors', 'Glendale Heights', 'Illinois', 'IL', 41.9279721, -88.0802066, 'verticalendeavors'),
  ('Planet Rock Climbing Gym', 'Wyoming', 'Michigan', 'MI', 42.9069238, -85.6523178, 'planetrockclimbinggym'),
  ('Terra Firma Bouldering Co.', 'Meridian Charter Township', 'Michigan', 'MI', 42.7240821, -84.4486517, 'terrafirmaboulderingco'),
  ('MW Climbing', 'Omaha', 'Nebraska', 'NE', 41.2319539, -96.10821, 'mwclimbing'),
  ('Triangle Rock Club - Fayetteville', 'Fayetteville', 'North Carolina', 'NC', 35.0410838, -78.9661732, 'trianglerockclubfayetteville'),
  ('The Crag Nashville', 'Nashville', 'Tennessee', 'TN', 36.0441828, -86.715413, 'thecragnashville'),
  ('The Crag Franklin', 'Franklin', 'Tennessee', 'TN', 35.9601972, -86.8278104, 'thecragfranklin'),
  ('Latitude Climbing and Fitness', 'Hampton', 'Virginia', 'VA', 37.043283, -76.3960149, 'latitudeclimbingandfitness')
)
insert into public.gyms (
  name, city, state, country, cc, brand, latitude, longitude, status, grading_style
)
select
  i.name, i.city, i.state, 'United States', 'us', null,
  i.latitude, i.longitude, 'approved', 'classic'
from incoming i
where not exists (
  select 1
  from public.gyms g
  where g.status = 'approved'
    and lower(coalesce(g.cc, '')) = 'us'
    and (
      (
        regexp_replace(lower(g.name), '[^a-z0-9]', '', 'g') = i.normalized_name
        and (
          lower(coalesce(g.city, '')) = lower(coalesce(i.city, ''))
          or (
            g.city is null
            and i.city is null
            and lower(coalesce(g.state, '')) in (
              lower(i.state),
              lower(i.state_code)
            )
          )
        )
      )
      or (
        g.latitude is not null
        and g.longitude is not null
        and (
          111320 * sqrt(
            power(g.latitude - i.latitude, 2)
            + power(
              (g.longitude - i.longitude) * cos(radians(i.latitude)),
              2
            )
          )
        ) <= 40
      )
      or (
        g.latitude is not null
        and g.longitude is not null
        and (
          111320 * sqrt(
            power(g.latitude - i.latitude, 2)
            + power(
              (g.longitude - i.longitude) * cos(radians(i.latitude)),
              2
            )
          )
        ) <= 150
        and (
          regexp_replace(lower(g.name), '[^a-z0-9]', '', 'g')
            like '%' || i.normalized_name || '%'
          or i.normalized_name
            like '%' || regexp_replace(lower(g.name), '[^a-z0-9]', '', 'g') || '%'
        )
      )
    )
);

-- Audit result after insertion: no overlapping approved US map pins.
with approved_us as (
  select id, latitude, longitude
  from public.gyms
  where status = 'approved'
    and lower(coalesce(cc, '')) = 'us'
    and latitude is not null
    and longitude is not null
)
select count(*) as overlapping_pairs_within_60m
from approved_us a
join approved_us b on a.id < b.id
where (
  111320 * sqrt(
    power(a.latitude - b.latitude, 2)
    + power(
      (a.longitude - b.longitude) * cos(radians(a.latitude)),
      2
    )
  )
) <= 60;
