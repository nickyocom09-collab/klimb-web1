#!/usr/bin/env node
/**
 * Build an idempotent Europe-only indoor climbing gym migration.
 *
 * The broad worldwide seed intentionally accepted generic OSM sports-centre
 * records. This audit is stricter: every OSM row must have explicit indoor or
 * building evidence and an indoor-climbing-style name. Google Maps-verified
 * gaps are kept in GOOGLE_VERIFIED so the evidence can be reviewed by hand.
 *
 * Source: OpenStreetMap contributors (ODbL 1.0) and public Google Maps
 * business listings checked on the date recorded below.
 *
 * Run: node scripts/build-europe-indoor-gym-audit.mjs
 */

import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const OUTPUT = resolve(
  process.cwd(),
  process.argv[2] ?? "migrations/0020_seed_verified_europe_indoor_gyms.sql",
);
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const COUNTRIES = [
  ["AL", "Albania"], ["AD", "Andorra"], ["AM", "Armenia"], ["AT", "Austria"],
  ["AZ", "Azerbaijan"], ["BY", "Belarus"], ["BE", "Belgium"],
  ["BA", "Bosnia and Herzegovina"], ["BG", "Bulgaria"], ["HR", "Croatia"],
  ["CY", "Cyprus"], ["CZ", "Czechia"], ["DK", "Denmark"], ["EE", "Estonia"],
  ["FI", "Finland"], ["FR", "France"], ["GE", "Georgia"], ["DE", "Germany"],
  ["GR", "Greece"], ["HU", "Hungary"], ["IS", "Iceland"], ["IE", "Ireland"],
  ["IT", "Italy"], ["KZ", "Kazakhstan"], ["XK", "Kosovo"], ["LV", "Latvia"],
  ["LI", "Liechtenstein"], ["LT", "Lithuania"], ["LU", "Luxembourg"],
  ["MT", "Malta"], ["MD", "Moldova"], ["MC", "Monaco"], ["ME", "Montenegro"],
  ["NL", "Netherlands"], ["MK", "North Macedonia"], ["NO", "Norway"],
  ["PL", "Poland"], ["PT", "Portugal"], ["RO", "Romania"], ["RU", "Russia"],
  ["SM", "San Marino"], ["RS", "Serbia"], ["SK", "Slovakia"], ["SI", "Slovenia"],
  ["ES", "Spain"], ["SE", "Sweden"], ["CH", "Switzerland"], ["TR", "Turkey"],
  ["UA", "Ukraine"], ["GB", "United Kingdom"], ["VA", "Vatican City"],
];

const GOOGLE_VERIFIED = [
  {
    name: "Bloc Cafe Gym Boulder",
    city: "Andorra la Vella",
    country: "Andorra",
    cc: "ad",
    latitude: 42.504784,
    longitude: 1.5183518,
    checked: "2026-07-31",
    evidence: "Google Maps: Rock climbing gym, current hours, official website",
  },
  {
    name: "Overz Club",
    city: "Yerevan",
    country: "Armenia",
    cc: "am",
    latitude: 40.1467494,
    longitude: 44.5097369,
    checked: "2026-07-31",
    evidence: "Google Maps: active climbing facility with bouldering and lead climbing",
  },
  {
    name: "ALP Idman Dirmanma Kompleksi",
    city: "Baku",
    country: "Azerbaijan",
    cc: "az",
    latitude: 40.3780704,
    longitude: 49.898039,
    checked: "2026-07-31",
    evidence: "Google Maps: active climbing complex with bouldering media",
  },
  {
    name: 'Skalodrom "Vershina"',
    city: "Brest",
    country: "Belarus",
    cc: "by",
    latitude: 52.0928688,
    longitude: 23.738512,
    checked: "2026-07-31",
    evidence: "Google Maps: current hours, official website, indoor bouldering media",
  },
];

// Country-by-country Google Maps cross-checks. Each listing below was active,
// categorized as an indoor climbing gym (or had unambiguous indoor-climbing
// reviews/media), and was not marked temporarily/permanently closed.
GOOGLE_VERIFIED.push(
  ...[
    ["Momentum Indoor Climbing Plovdiv", "Plovdiv", "Bulgaria", "bg", 42.1588091, 24.7557954],
    ["Boulder Zona", "Zagreb", "Croatia", "hr", 45.7958918, 15.9002847],
    ["Climbing Center Marulianus", "Split", "Croatia", "hr", 43.5185132, 16.4317921],
    ["Climbing Gym TNT", "Split", "Croatia", "hr", 43.5477447, 16.4513397],
    ["Rijecki alpinisticki klub", "Rijeka", "Croatia", "hr", 45.3202876, 14.4610311],
    ["LCC Limassol Climbing Club", "Limassol", "Cyprus", "cy", 34.6901371, 33.0582831],
    ["Rockstar Climbing", "Strovolos", "Cyprus", "cy", 35.1397873, 33.3678078],
    ["Redpoint Climbing & Parkour", "Nicosia", "Cyprus", "cy", 35.1804255, 33.3940057],
    ["Sharpa Climb Inn", "Nicosia", "Cyprus", "cy", 35.1760979, 33.3660403],
    ["Beta Boulders Sydhavn", "Copenhagen", "Denmark", "dk", 55.6558778, 12.5508968],
    ["Beta Boulders Osterbro", "Copenhagen", "Denmark", "dk", 55.7069046, 12.5610693],
    ["Beta Boulders Vanlose", "Copenhagen", "Denmark", "dk", 55.6834661, 12.4909652],
    ["Blocs & Walls", "Copenhagen", "Denmark", "dk", 55.6928809, 12.6107211],
    ["Bison Boulders Tobaksbyen", "Soborg", "Denmark", "dk", 55.7405644, 12.4767822],
    ["Copenhagen Boulders", "Copenhagen", "Denmark", "dk", 55.6411893, 12.5391754],
    ["Boulders Aarhus City", "Aarhus", "Denmark", "dk", 56.1482289, 10.190898],
    ["Boulders Amager", "Kastrup", "Denmark", "dk", 55.6193837, 12.6307087],
    ["KIVI Climbing", "Tallinn", "Estonia", "ee", 59.404781, 24.7348823],
    ["Ronimisministeerium Hipodroom", "Tallinn", "Estonia", "ee", 59.4349682, 24.7029005],
    ["Ronimisministeerium T1", "Tallinn", "Estonia", "ee", 59.4244333, 24.7946639],
    ["Ronimistehas Bouldersaal", "Tartu", "Estonia", "ee", 58.3612485, 26.7387482],
    ["Ronimistehas Rope Climbing Gym", "Tartu", "Estonia", "ee", 58.3609809, 26.7397918],
    ["Ronimisministeerium Mustika", "Tallinn", "Estonia", "ee", 59.4105344, 24.6833002],
    ["Ronimisministeerium Suur-Paala", "Tallinn", "Estonia", "ee", 59.4280679, 24.8129841],
    ["Ronimaa Ronimiskeskus", "Parnu", "Estonia", "ee", 58.4049674, 24.503046],
    ["KiipeilyAreena Salmisaari", "Helsinki", "Finland", "fi", 60.1660876, 24.9041841],
    ["KiipeilyAreena Ristikko - Konala", "Helsinki", "Finland", "fi", 60.2393043, 24.8494161],
    ["KiipeilyAreena Kalasatama", "Helsinki", "Finland", "fi", 60.1861818, 24.9783482],
    ["Kaamos Climbing", "Oulu", "Finland", "fi", 64.9908999, 25.4577961],
    ["Boulderkeskus Espoo", "Espoo", "Finland", "fi", 60.1663583, 24.7018034],
    ["Boulder Center Pasila", "Helsinki", "Finland", "fi", 60.1959683, 24.9326087],
    ["THE WALL", "Athens", "Greece", "gr", 38.0092298, 23.8727769],
    ["OAKA Indoor Climbing", "Athens", "Greece", "gr", 38.0385102, 23.7826751],
    ["Crux Climbing Gym", "Thessaloniki", "Greece", "gr", 40.6213188, 22.9561176],
    ["Block Patra Climbing + Fitness Club", "Patras", "Greece", "gr", 38.2269021, 21.7465194],
    ["Monkey Boulder", "Budapest", "Hungary", "hu", 47.556929, 19.0486873],
    ["Klifurhusid", "Reykjavik", "Iceland", "is", 64.1361541, -21.8779196],
    ["600Klifur", "Akureyri", "Iceland", "is", 65.6867457, -18.1083203],
    ["Klifurfell Klifurhus", "Grundarfjordur", "Iceland", "is", 64.9274125, -23.2593324],
    ["Kraftlyftingafelag Akureyrar", "Akureyri", "Iceland", "is", 65.8510837, -18.1930087],
    ["Gravity Climbing Centre", "Dublin", "Ireland", "ie", 53.335754, -6.323554],
    ["Dublin Climbing Centre", "Tallaght", "Ireland", "ie", 53.2898625, -6.3710796],
    ["Awesome Walls Dublin", "Dublin", "Ireland", "ie", 53.401674, -6.3164966],
    ["Bloc Climbing Gym", "Dublin", "Ireland", "ie", 53.3184176, -6.3467551],
    ["UL Sport Climbing Wall", "Limerick", "Ireland", "ie", 52.673639, -8.5644523],
    ["Suas Climbing Centre", "Limerick", "Ireland", "ie", 52.6835403, -8.5782165],
    ["Awesome Walls Cork", "Cork", "Ireland", "ie", 51.8907819, -8.5385285],
    ["Gym Fitness Center", "Pristina", "Kosovo", "xk", 42.6279863, 21.1482092],
    ["Vagonu Wall", "Riga", "Latvia", "lv", 56.9502856, 24.1498336],
    ["Falkors", "Riga", "Latvia", "lv", 56.9685955, 24.1662817],
    ["Rock Climbing Gym Traverss", "Riga", "Latvia", "lv", 56.9388931, 24.1564947],
    ["SKALA Sporta Kapsanas Klubs", "Riga", "Latvia", "lv", 56.9384535, 24.1564901],
    ["Boulder House", "Kaunas", "Lithuania", "lt", 54.9189034, 23.9689603],
    ["Scala Dream Climbing Center", "Klaipeda", "Lithuania", "lt", 55.6843323, 21.1862765],
    ["Boulder Barn Climbing", "Panevezys", "Lithuania", "lt", 55.7379564, 24.1691662],
    ["KOPKOP Laipiojimo Klubas", "Ukmerge", "Lithuania", "lt", 55.2504797, 24.7588971],
    ["Crashpad Climbing Centre", "Birkirkara", "Malta", "mt", 35.885508, 14.473707],
    ["Climbing Wall", "Chisinau", "Moldova", "md", 47.018307, 28.8068391],
    ["Boka Place Climbing Wall", "Tivat", "Montenegro", "me", 42.4383549, 18.695194],
    ["Beest Boulders Amsterdam", "Amsterdam", "Netherlands", "nl", 52.3816739, 4.8594025],
    ["Monk Bouldergym Amsterdam", "Amsterdam", "Netherlands", "nl", 52.3835983, 4.9293842],
    ["Boulder Amsterdam", "Amsterdam", "Netherlands", "nl", 52.3765411, 4.871359],
    ["Beta Boulders Amsterdam", "Amsterdam", "Netherlands", "nl", 52.344188, 4.8558218],
    ["Boulderhal de Campus", "The Hague", "Netherlands", "nl", 52.0497054, 4.2544035],
    ["Klimmuur Amsterdam Centraal", "Amsterdam", "Netherlands", "nl", 52.3766181, 4.911574],
    ["Boulderhal Kunststof", "Leiden", "Netherlands", "nl", 52.145052, 4.481017],
    ["Be Boulder", "Amsterdam", "Netherlands", "nl", 52.3397505, 4.8425602],
    ["Astibo Climbing Gym", "Stip", "North Macedonia", "mk", 41.7354689, 22.1927164],
    ["Bolder", "Kumanovo", "North Macedonia", "mk", 42.1328168, 21.7193068],
    ["Boulder Gym A.K. Skopje", "Skopje", "North Macedonia", "mk", 41.9829602, 21.4363977],
    ["Oslo Klatresenter", "Oslo", "Norway", "no", 59.8675669, 10.8416713],
    ["Buldreterminalen", "Tromso", "Norway", "no", 69.6690517, 18.921387],
    ["Klatreverket Drammen Stromso", "Drammen", "Norway", "no", 59.7306207, 10.2234269],
    ["Klatreverket Torshov", "Oslo", "Norway", "no", 59.9347922, 10.759512],
    ["Tromso Klatresenter", "Tromso", "Norway", "no", 69.6746216, 18.9555208],
    ["Klatreverket Lokka", "Oslo", "Norway", "no", 59.9293734, 10.757883],
    ["Vestveggen Bergen Klatreklubb", "Bergen", "Norway", "no", 60.4697701, 5.3136408],
    ["Flow Dlugosza", "Wroclaw", "Poland", "pl", 51.134777, 17.0632191],
    ["WEST Bouldering", "Warsaw", "Poland", "pl", 52.1923044, 20.9350028],
    ["Lokal 32 Boulderownia Wroclaw", "Wroclaw", "Poland", "pl", 51.0894714, 17.0121808],
    ["Problem Bouldering", "Gdansk", "Poland", "pl", 54.4001028, 18.5908299],
    ["Crux Boulder", "Warsaw", "Poland", "pl", 52.2245368, 21.0101528],
    ["Avatar", "Krakow", "Poland", "pl", 50.061538, 20.0170731],
    ["Groto Poznan Boulderownia", "Poznan", "Poland", "pl", 52.3769959, 16.9431573],
    ["Arena Wspinaczkowa Makak", "Warsaw", "Poland", "pl", 52.2975025, 20.9066794],
    ["Vertigo Climbing Wall", "Lisbon", "Portugal", "pt", 38.7400043, -9.102017],
    ["Vertigo Oriente Climbing Center", "Lisbon", "Portugal", "pt", 38.7609388, -9.1026154],
    ["Crux Climbing Center", "Oeiras", "Portugal", "pt", 38.7211859, -9.330768],
    ["The North Wall", "Porto", "Portugal", "pt", 41.1846055, -8.6217375],
    ["Gravity", "Cluj-Napoca", "Romania", "ro", 46.7488307, 23.541903],
    ["Centrul Climb Again", "Bucharest", "Romania", "ro", 44.3889214, 26.1216056],
    ["HangOut Climbing Gym", "Targu Mures", "Romania", "ro", 46.5392197, 24.5985042],
    ["Natural High Bucuresti", "Bucharest", "Romania", "ro", 44.4332398, 26.0535515],
    ["Galactic Gym", "Bucharest", "Romania", "ro", 44.4604772, 26.0388585],
    ["Climb House Brasov", "Brasov", "Romania", "ro", 45.6310897, 25.6228213],
    ["BLX Bouldering Club", "Solna", "Sweden", "se", 59.3701453, 18.0048276],
    ["Bouldering Stockholm", "Stockholm", "Sweden", "se", 59.289722, 18.0821468],
    ["Backa Boulder", "Gothenburg", "Sweden", "se", 57.7196927, 11.9510389],
    ["Karbin Indoor Climbing", "Stockholm", "Sweden", "se", 59.2894518, 18.0176457],
    ["Urban Boulders", "Linkoping", "Sweden", "se", 58.4201128, 15.6175024],
    ["Klatterdomen", "Gothenburg", "Sweden", "se", 57.7362966, 12.0305659],
    ["Klattercentret Malmo", "Malmo", "Sweden", "se", 55.5873497, 13.0251987],
    ["Klattercentret Solna", "Solna", "Sweden", "se", 59.3568965, 18.0162669],
    ["Boulder Jungle Climbing Gym", "Antalya", "Turkey", "tr", 36.9264287, 30.7259762],
    ["Boulderhane", "Istanbul", "Turkey", "tr", 41.07595, 29.01342],
    ["DuvarX", "Istanbul", "Turkey", "tr", 40.95057, 29.124172],
    ["Mozaik Climbing & Bouldering", "Antalya", "Turkey", "tr", 36.88774, 30.65352],
    ["Boulder Istanbul", "Istanbul", "Turkey", "tr", 40.9937398, 29.0267851],
    ["Boulder Eskisehir", "Eskisehir", "Turkey", "tr", 39.7745356, 30.5049185],
    ["Climbing Gym S.K. Lucky", "Tbilisi", "Georgia", "ge", 41.7180258, 44.7408308],
    ["Climb.ge", "Tbilisi", "Georgia", "ge", 41.7124684, 44.747631],
    ["Urban Climbing Tbilisi", "Tbilisi", "Georgia", "ge", 41.7276788, 44.8172618],
    ["The Castle Climbing Centre", "London", "United Kingdom", "gb", 51.5653079, -0.0925618],
    ["Aldgate City Bouldering", "London", "United Kingdom", "gb", 51.5144051, -0.0745315],
    ["The Reach Climbing Wall", "London", "United Kingdom", "gb", 51.4943567, 0.043023],
    ["Climbing District London Fields", "London", "United Kingdom", "gb", 51.5345229, -0.0602298],
    ["Mile End Climbing Wall", "London", "United Kingdom", "gb", 51.527699, -0.0398529],
    ["The Ordinary Climbers Rock Climbing Gym", "Polegate", "United Kingdom", "gb", 50.8190535, 0.269822],
    ["Rise Climbing", "London", "United Kingdom", "gb", 51.5111907, 0.0127571],
    ["Bethwall Green Climbing Centre", "London", "United Kingdom", "gb", 51.527598, -0.056319],
  ].map(([name, city, country, cc, latitude, longitude]) => ({
    name, city, country, cc, latitude, longitude,
    checked: "2026-07-31",
    evidence: "Google Maps: active indoor climbing listing with current hours/category/reviews",
  })),
);

GOOGLE_VERIFIED.push(
  ...[
    ["City Adventure Center", "Graz", "Austria", "at", 47.0651946, 15.4223304],
    ["KI - Kletterzentrum Innsbruck", "Innsbruck", "Austria", "at", 47.2768708, 11.4135132],
    ["Kletterhalle Wien", "Vienna", "Austria", "at", 48.229992, 16.4510054],
    ["SKALA Climbing Gym", "Almaty", "Kazakhstan", "kz", 43.1476928, 76.8989074],
    ["Cave Boulder", "Almaty", "Kazakhstan", "kz", 43.2428161, 76.9085741],
    ["CozyRock", "Almaty", "Kazakhstan", "kz", 43.2409184, 76.8761843],
    ["Climbers Garden", "Astana", "Kazakhstan", "kz", 51.0933065, 71.4293365],
    ["Skala Boulder", "Almaty", "Kazakhstan", "kz", 43.2396422, 76.9271472],
    ["Climbing Gym Gekon", "Belgrade", "Serbia", "rs", 44.8210739, 20.4652985],
    ["Penjacki Klub Granit", "Belgrade", "Serbia", "rs", 44.8139932, 20.4723421],
  ].map(([name, city, country, cc, latitude, longitude]) => ({
    name, city, country, cc, latitude, longitude,
    checked: "2026-07-31",
    evidence: "Google Maps: active indoor climbing listing with current hours/category/reviews",
  })),
);

// Rows from the broad 0012 import that Google Maps positively identifies as
// natural/outdoor rather than indoor gyms. Set them pending instead of deleting
// so any existing profile or route references remain intact.
const DELIST = [
  ["Qendër Alpinizmi Guri i Cjapit", "al", "Google Maps identifies this location as the Guri i Capit mountain peak"],
  ["Вяровачны гарадок", "by", "Outdoor ropes course"],
  ["Вяровачны горад", "by", "Outdoor ropes course"],
  ["Паласа перашкодаў", "by", "Obstacle course"],
  ["Скаўт парк", "by", "Outdoor scout park"],
  ["Funtopia", "bg", "Google Maps categorizes this as an amusement center"],
  ["Въжена градина", "bg", "Outdoor ropes course"],
  ["Antovo", "hr", "Natural climbing formation"],
  ["Crljenica C1", "hr", "Natural climbing sector"],
  ["Dwarfs", "hr", "Natural climbing sector"],
  ["Kuk Nozicar", "hr", "Natural climbing formation"],
  ["Kuk od Buzeline strane", "hr", "Natural climbing formation"],
  ["Kuk od Pasćetnice", "hr", "Natural climbing formation"],
  ["Kuk od Skradelin", "hr", "Natural climbing formation"],
  ["Kuk Tisa", "hr", "Natural climbing formation"],
  ["Mali Ćuk", "hr", "Natural climbing formation"],
  ["Naravno Plezališče", "hr", "Natural climbing area"],
  ["Ovčji kuk", "hr", "Natural climbing formation"],
  ["Pasjanice", "hr", "Natural climbing sector"],
  ["Veliki Ćuk", "hr", "Natural climbing formation"],
  ["Veliki Vitrenik B1", "hr", "Natural climbing sector"],
  ["Veliki Vitrenik B2", "hr", "Natural climbing sector"],
  ["Zarečki Krov", "hr", "Natural climbing formation"],
  ["Zub od Manite peći", "hr", "Natural climbing formation"],
  ["Metsjärve puhkekeskus", "ee", "Holiday and outdoor recreation center"],
  ["Seikkailupuisto Laajis", "fi", "Adventure park"],
  ["სვერის \"ვია ფერატა\"", "ge", "Via ferrata"],
  ["Αναρριχητικό πεδίο Φιλύρου", "gr", "Natural climbing field"],
  ["Parcul de Frânghii „Family Park”", "md", "Outdoor ropes park"],
  ["Park Linowy Tatra Adventure Chochołów", "pl", "Outdoor ropes park"],
  ["Ściana skalna pod Kostryniem", "pl", "Natural rock wall"],
  ["Skały wspinaczkowe", "pl", "Natural climbing rocks"],
  ["Boulder do Morcego", "pt", "Outdoor boulder near Palmela"],
  ["Crazy Boulder", "pt", "Outdoor boulder near Palmela"],
  ["Arka Park", "ro", "Adventure park"],
  ["Ali Kayası", "tr", "Natural rock formation"],
  ["Macera Park", "tr", "Adventure park"],
];

const INDOOR_NAME = /(?:boulder|bloc|climb|klim|kletterhalle|kletterzentrum|klettergym|klettertreff|escalad|rocodrom|rocodrome|rocodromo|rocodromu|rocodróm|ściank|wspinac|lezeck|lezec|mászó|maszo|penjanje|plezal|sala de escalada|salle d.escalade|ścięna)/iu;
const STRONG_INDOOR_NAME = /(?:boulder|bloc|indoor|gym|hall|halle|zaal|sala|salle|center|centre|centrum|keskus|areena|klatreverk|klatresenter|kiipeily|ronimis|climbing wall|klimmuur|kletterzentrum|kletterhalle|rocodrom)/iu;
const OUTDOOR_NAME = /(?:outdoor|open air|via ferrata|klettersteig|kletterwald|climbing forest|adventure park|adventure course|high ropes|low ropes|crag|falesia|climbing garden|klettergarten|buitenmuur|carriere|carrière|trekking|guide service|tour operator|scout tower|abseil tower)/iu;

const ALIAS_GROUPS = [
  ["klimmuuramsterdamcentraal", "klimmuurcentraal"],
  ["bouldercenterpasila", "boulderkeskuspasila"],
  ["blocswalls", "blocsandwalls"],
  ["bloc", "blocclimbinggym"],
  ["betaboulders", "betabouldersamsterdam"],
  ["vertigoclimbingcenter", "vertigoclimbingwall"],
  ["bisonboulders", "bisonboulderstobaksbyen"],
  ["bouldersaarhusc", "bouldersaarhuscity"],
  ["flowclimbingspace", "flowdlugosza"],
  ["aldgatecitybouldering", "citybouldering"],
  ["bethwallclimbingcentre", "bethwallgreenclimbingcentre"],
  ["beboulder", "boulderhalluchthaven"],
];
const ALIAS_BY_NAME = new Map(
  ALIAS_GROUPS.flatMap((group, index) => group.map((name) => [name, index])),
);

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

function normalise(value = "") {
  const result = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replaceAll("ø", "o")
    .replaceAll("ł", "l")
    .replaceAll("ß", "ss")
    .replaceAll("æ", "ae")
    .replaceAll("œ", "oe")
    .replaceAll("ð", "d")
    .replaceAll("þ", "th")
    .replaceAll("ı", "i")
    .replace(/[^a-z0-9]+/g, "");
  return result || null;
}

function sql(value) {
  if (value === null || value === undefined || value === "") return "null";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function pointFor(element) {
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
}

function distanceMeters(a, b) {
  const averageLatitude = ((a.latitude + b.latitude) / 2) * Math.PI / 180;
  const y = (a.latitude - b.latitude) * 111_000;
  const x = (a.longitude - b.longitude) * 111_000 * Math.cos(averageLatitude);
  return Math.hypot(x, y);
}

function equivalentGymName(a, b) {
  const left = normalise(a);
  const right = normalise(b);
  if (left && left === right) return true;
  return left && right && ALIAS_BY_NAME.get(left) === ALIAS_BY_NAME.get(right)
    && ALIAS_BY_NAME.has(left);
}

function hasIndoorEvidence(tags, name) {
  if (tags.indoor === "yes" || tags["climbing:indoor"] === "yes") return true;
  if (tags.building && !["no", "ruins", "roof"].includes(tags.building)) return true;
  const officialWebsite = tags.website ?? tags["contact:website"] ?? tags.url;
  if (officialWebsite && STRONG_INDOOR_NAME.test(name)) return true;
  return false;
}

function overpassQuery(cc) {
  return `[out:json][timeout:180];
    area["ISO3166-1"="${cc}"][boundary=administrative]->.country;
    (
      nwr(area.country)["sport"="climbing"]["leisure"~"sports_centre|sports_hall|fitness_centre"];
      nwr(area.country)["climbing"="boulder"]["indoor"="yes"];
      nwr(area.country)["climbing:boulder"="yes"]["indoor"="yes"];
    );
    out tags center;`;
}

async function fetchCountry(cc) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const endpoint = OVERPASS_ENDPOINTS[attempt % OVERPASS_ENDPOINTS.length];
    try {
      const { stdout } = await execFileAsync(
        "curl",
        [
          "--fail", "--silent", "--show-error", "--max-time", "55",
          "-X", "POST", endpoint, "--data-urlencode", `data=${overpassQuery(cc)}`,
        ],
        { maxBuffer: 60 * 1024 * 1024 },
      );
      return JSON.parse(stdout).elements ?? [];
    } catch (error) {
      lastError = error;
      await sleep((attempt + 1) * 2_000);
    }
  }
  throw new Error(`${cc}: ${lastError?.message ?? "Overpass request failed"}`);
}

async function main() {
  const gyms = [];
  const sourceCounts = new Map();

  for (const [ccUpper, country] of COUNTRIES) {
    process.stdout.write(`Auditing ${country}... `);
    let elements;
    try {
      elements = await fetchCountry(ccUpper);
    } catch (error) {
      console.warn(`unavailable (${error.message})`);
      sourceCounts.set(ccUpper.toLowerCase(), { country, fetched: 0, accepted: 0, unavailable: true });
      continue;
    }

    let accepted = 0;
    for (const element of elements) {
      const tags = element.tags ?? {};
      const name = tags.name?.trim();
      const point = pointFor(element);
      if (
        !name
        || !point
        || DELIST.some(([rejectedName, rejectedCc]) => rejectedCc === ccUpper.toLowerCase() && rejectedName === name)
        || OUTDOOR_NAME.test(name)
        || !INDOOR_NAME.test(name)
        || !hasIndoorEvidence(tags, name)
        || tags.natural
        || tags["climbing:outdoor"] === "yes"
        || tags["climbing:rock"] === "yes"
      ) continue;

      gyms.push({
        name,
        city: tags["addr:city"] ?? tags["addr:town"] ?? tags["addr:place"] ?? null,
        country,
        cc: ccUpper.toLowerCase(),
        ...point,
        source: `OpenStreetMap ${element.type}/${element.id}`,
      });
      accepted += 1;
    }

    sourceCounts.set(ccUpper.toLowerCase(), { country, fetched: elements.length, accepted });
    console.log(`${accepted}/${elements.length} strict indoor records`);
    await sleep(900);
  }

  gyms.push(...GOOGLE_VERIFIED.map((gym) => ({ ...gym, source: `Google Maps checked ${gym.checked}: ${gym.evidence}` })));

  const deduped = [];
  for (const gym of gyms) {
    const duplicateIndex = deduped.findIndex((candidate) =>
      candidate.cc === gym.cc
      && equivalentGymName(candidate.name, gym.name)
      && distanceMeters(candidate, gym) < 170,
    );
    if (duplicateIndex === -1) {
      deduped.push(gym);
      continue;
    }

    const existing = deduped[duplicateIndex];
    const preferIncoming =
      (gym.source.startsWith("Google Maps") && !existing.source.startsWith("Google Maps"))
      || (!existing.city && Boolean(gym.city));
    if (preferIncoming) deduped[duplicateIndex] = gym;
  }

  const sorted = deduped.sort(
    (a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name),
  );
  const values = sorted.map((gym) =>
    `  (${sql(gym.name)}, ${sql(gym.city)}, ${sql(gym.country)}, ${sql(gym.cc)}, ${sql(gym.latitude)}, ${sql(gym.longitude)}, ${sql(normalise(gym.name))})`,
  );
  const coverage = COUNTRIES.map(([cc, country]) => {
    const result = sourceCounts.get(cc.toLowerCase());
    const googleCount = GOOGLE_VERIFIED.filter((gym) => gym.cc === cc.toLowerCase()).length;
    if (result?.unavailable) return `-- ${country} (${cc}): source unavailable; Google verified ${googleCount}`;
    return `-- ${country} (${cc}): OSM accepted ${result?.accepted ?? 0}/${result?.fetched ?? 0}; Google verified ${googleCount}`;
  }).join("\n");

  const delistNames = DELIST.map(([name, cc, reason]) =>
    `  (${sql(name)}, ${sql(cc)}, ${sql(reason)})`,
  ).join(",\n");
  const content = `-- Klimb verified Europe indoor climbing gym audit, generated ${new Date().toISOString().slice(0, 10)}
-- OpenStreetMap candidates require explicit indoor/building evidence plus an
-- indoor-climbing name. Google-only gaps are manually verified in the generator.
-- Natural crags, outdoor walls, via ferratas, climbing forests, adventure parks,
-- high-ropes courses, guides, and tour operators are excluded.
--
${coverage}

-- Hide confirmed outdoor/non-gym rows without cascading away any user data.
with rejected (name, cc, reason) as (
values
${delistNames}
)
update public.gyms g
set status = 'pending'
from rejected r
where lower(g.name) = lower(r.name)
  and lower(coalesce(g.cc, '')) = r.cc
  and g.status = 'approved';

-- Catch unmistakable outdoor/adventure labels from earlier broad imports.
-- This intentionally changes visibility only; it never deletes user data.
update public.gyms
set status = 'pending'
where status = 'approved'
  and lower(coalesce(cc, '')) in (${COUNTRIES.map(([cc]) => sql(cc.toLowerCase())).join(", ")})
  and name ~* '(via ferrata|klettersteig|kletterwald|hochseilgarten|waldseilgarten|seilgarten|park linowy|parc aventure|parco avventura|parque (de )?aventura|climbing forest|climbing (area|crag|sector)|falesia|falaise|klettergarten|high ropes|rope course|adventure park|parcul de fr.nghii|accrobranche|tree climbing|scout park|obstacle course|palestra di roccia)';

with incoming (name, city, country, cc, latitude, longitude, normalized_name) as (
values
${values.join(",\n")}
)
insert into public.gyms (
  name, city, state, country, cc, brand, latitude, longitude, status, grading_style
)
select
  i.name, i.city, null, i.country, i.cc, null,
  i.latitude, i.longitude, 'approved', 'classic'
from incoming i
where not exists (
  select 1
  from public.gyms g
  where (
      lower(g.name) = lower(i.name)
      or (
        i.normalized_name is not null
        and regexp_replace(lower(g.name), '[^a-z0-9]+', '', 'g') = i.normalized_name
      )
    )
    and (
      (
        g.latitude is not null and g.longitude is not null
        and abs(g.latitude - i.latitude) < 0.0015
        and abs(g.longitude - i.longitude) < 0.0015
      )
      or (
        lower(coalesce(g.city, '')) = lower(coalesce(i.city, ''))
        and lower(coalesce(g.country, '')) = lower(i.country)
      )
    )
);

-- Candidate rows after strict source filtering: ${sorted.length}
`;

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, content);
  console.log(`Wrote ${sorted.length} duplicate-safe rows to ${OUTPUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
