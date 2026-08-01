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
  process.argv[2] ?? "migrations/0019_seed_verified_europe_indoor_gyms.sql",
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

// Rows from the broad 0012 import that Google Maps positively identifies as
// natural/outdoor rather than indoor gyms. Set them pending instead of deleting
// so any existing profile or route references remain intact.
const DELIST = [
  ["Qendër Alpinizmi Guri i Cjapit", "al", "Google Maps identifies this location as the Guri i Capit mountain peak"],
  ["Вяровачны гарадок", "by", "Outdoor ropes course"],
  ["Вяровачны горад", "by", "Outdoor ropes course"],
  ["Паласа перашкодаў", "by", "Obstacle course"],
  ["Скаўт парк", "by", "Outdoor scout park"],
];

const INDOOR_NAME = /(?:boulder|bloc|climb|klim|kletterhalle|kletterzentrum|klettergym|klettertreff|escalad|rocodrom|rocodrome|rocodromo|rocodromu|rocodróm|ściank|wspinac|lezeck|lezec|mászó|maszo|penjanje|plezal|sala de escalada|salle d.escalade|ścięna)/iu;
const OUTDOOR_NAME = /(?:outdoor|open air|via ferrata|klettersteig|kletterwald|climbing forest|adventure park|adventure course|high ropes|low ropes|crag|falesia|climbing garden|klettergarten|buitenmuur|carriere|carrière|trekking|guide service|tour operator|scout tower|abseil tower)/iu;

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

function normalise(value = "") {
  const result = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
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

function hasIndoorEvidence(tags) {
  if (tags.indoor === "yes" || tags["climbing:indoor"] === "yes") return true;
  if (tags.building && !["no", "ruins", "roof"].includes(tags.building)) return true;
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
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const endpoint = OVERPASS_ENDPOINTS[attempt % OVERPASS_ENDPOINTS.length];
    try {
      const { stdout } = await execFileAsync(
        "curl",
        [
          "--fail", "--silent", "--show-error", "--max-time", "190",
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
        || OUTDOOR_NAME.test(name)
        || !INDOOR_NAME.test(name)
        || !hasIndoorEvidence(tags)
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

  const byPhysicalGym = new Map();
  for (const gym of gyms) {
    const key = `${normalise(gym.name) ?? gym.name.toLocaleLowerCase()}|${gym.latitude.toFixed(4)}|${gym.longitude.toFixed(4)}`;
    if (!byPhysicalGym.has(key)) byPhysicalGym.set(key, gym);
  }

  const sorted = [...byPhysicalGym.values()].sort(
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
        and lower(regexp_replace(g.name, '[^a-z0-9]+', '', 'g')) = i.normalized_name
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
