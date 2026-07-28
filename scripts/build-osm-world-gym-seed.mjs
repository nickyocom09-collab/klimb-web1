#!/usr/bin/env node
/**
 * Builds an idempotent worldwide indoor-climbing-gym seed from OpenStreetMap.
 *
 * Source: © OpenStreetMap contributors, ODbL 1.0. The source is intentionally
 * limited to explicitly mapped artificial climbing facilities. Natural crags
 * and the already-imported United States are excluded.
 *
 * Run: node scripts/build-osm-world-gym-seed.mjs
 * Output: migrations/0012_seed_osm_world_climbing_gyms.sql
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const OUTPUT = resolve(process.cwd(), process.argv[2] ?? "migrations/0012_seed_osm_world_climbing_gyms.sql");
const OVERPASS = "https://overpass-api.de/api/interpreter";
const COUNTRIES = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";

// These overlapping regions keep individual public Overpass requests useful
// and reliable. OSM ids and local coordinates are deduplicated below.
const REGIONS = [
  // Canada, Mexico, Central America, and the Caribbean. These exclude the
  // large U.S. interior from the query itself (the U.S. was seeded separately)
  // and prevent a continent-wide request from timing out.
  "41,-141,49,-110", "41,-110,49,-80", "41,-80,49,-52",
  "49,-141,60,-110", "49,-110,60,-80", "49,-80,60,-52",
  "60,-141,75,-110", "60,-110,75,-80", "60,-80,75,-52", "75,-169,85,-52",
  "14,-118,24,-102", "14,-102,24,-86", "24,-118,32,-102", "24,-102,32,-86",
  "7,-92,14,-77", "17,-88,27,-60", // North/Central America
  "-56,-82,13,-34", // South America
  "34,-25,50,5", "34,5,50,25", "34,25,50,45", "50,-12,72,45", // Europe
  "-35,-18,5,20", "-35,20,5,52", "5,-18,38,20", "5,20,38,52", // Africa
  "0,25,30,65", "0,65,30,105", "0,105,30,145", // South Asia
  "30,25,60,65", "30,65,60,105", "30,105,60,145", // East/Central Asia
  "60,25,85,90", "60,90,85,180", // Northern Asia
  "-50,110,0,145", "-50,145,0,180", "-50,-180,0,-150", // Oceania and Pacific
];

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const execFileAsync = promisify(execFile);
const OUTDOOR_NAME = /\b(falesia|palestra di roccia|via ferrata|klettersteig|climbing crag|rock climbing area|climbing area|climbing sector|climbing route|boulder garden|high ropes|low ropes|obstacle course)\b/i;

function normalise(value = "") {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function sql(value) {
  if (value === null || value === undefined || value === "") return "null";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = (yi > y) !== (yj > y);
    if (crosses && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point, coordinates) {
  return pointInRing(point, coordinates[0]) && !coordinates.slice(1).some((ring) => pointInRing(point, ring));
}

function countryForPoint(point, features) {
  for (const feature of features) {
    const geometry = feature.geometry;
    const inside = geometry.type === "Polygon"
      ? pointInPolygon(point, geometry.coordinates)
      : geometry.coordinates.some((polygon) => pointInPolygon(point, polygon));
    if (!inside) continue;
    const cc = feature.properties.ISO_A2_EH ?? feature.properties.ISO_A2;
    if (!/^[A-Z]{2}$/.test(cc)) return null;
    return { country: feature.properties.ADMIN, cc: cc.toLowerCase() };
  }
  return null;
}

function pointFor(element) {
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  return Number.isFinite(lat) && Number.isFinite(lon) ? [lon, lat] : null;
}

function overpassQuery(bbox) {
  return `[out:json][timeout:180];
    (
      node["sport"="climbing"]["leisure"~"sports_centre|sports_hall|fitness_centre"](${bbox});
      way["sport"="climbing"]["leisure"~"sports_centre|sports_hall|fitness_centre"](${bbox});
    );
    out tags center;`;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.json();
}

async function fetchOverpass(query) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const { stdout } = await execFileAsync("curl", [
        "--fail", "--silent", "--show-error", "--max-time", "35", "-G", OVERPASS,
        "--data-urlencode", `data=${query}`,
      ], { maxBuffer: 50 * 1024 * 1024 });
      return JSON.parse(stdout);
    } catch (error) {
      lastError = error;
      console.warn(`Overpass attempt ${attempt}/2 failed; retrying…`);
      await sleep(attempt * 3_000);
    }
  }
  console.warn(`Skipping unavailable regional response: ${lastError.message}`);
  return null;
}

async function main() {
  const countryGeoJson = await fetchJson(COUNTRIES);
  const elements = [];
  const unavailableRegions = [];
  for (const bbox of REGIONS) {
    console.log(`Fetching ${bbox}…`);
    const data = await fetchOverpass(overpassQuery(bbox));
    if (data) elements.push(...(data.elements ?? []));
    else unavailableRegions.push(bbox);
    await sleep(1200);
  }

  const seenOsm = new Set();
  const seenGym = new Set();
  const gyms = [];
  for (const element of elements) {
    const osmKey = `${element.type}/${element.id}`;
    if (seenOsm.has(osmKey)) continue;
    seenOsm.add(osmKey);

    const tags = element.tags ?? {};
    const point = pointFor(element);
    if (
      !tags.name
      || !point
      || tags.natural
      || OUTDOOR_NAME.test(tags.name)
      || ["crag", "area", "route"].includes(tags.climbing)
      || tags["climbing:rock"] === "yes"
      || tags["climbing:outdoor"] === "yes"
    ) continue;
    const location = countryForPoint(point, countryGeoJson.features);
    if (!location || location.cc === "us") continue;

    const [longitude, latitude] = point;
    const city = tags["addr:city"] ?? tags["addr:place"] ?? null;
    const key = `${normalise(tags.name)}|${Math.round(latitude * 10_000)}|${Math.round(longitude * 10_000)}`;
    if (seenGym.has(key)) continue;
    seenGym.add(key);
    gyms.push({ name: tags.name.trim(), city, ...location, latitude, longitude });
  }

  gyms.sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name));
  const values = gyms.map((gym) => `  (${sql(gym.name)}, ${sql(gym.city)}, null, ${sql(gym.country)}, ${sql(gym.cc)}, null, ${sql(gym.latitude)}, ${sql(gym.longitude)}, 'approved', 'classic', ${sql(normalise(gym.name))})`);
  const unavailableNote = unavailableRegions.length
    ? `-- Unavailable source regions (safe to retry later): ${unavailableRegions.join(", ")}\n`
    : "";
  const content = `-- Klimb — worldwide indoor climbing gym base, generated ${new Date().toISOString().slice(0, 10)}\n-- Source: © OpenStreetMap contributors, available under the ODbL 1.0.\n-- Generated with scripts/build-osm-world-gym-seed.mjs. Do not hand-edit; rerun\n-- the script to refresh. Natural crags and U.S. facilities are excluded.\n--\n-- Duplicate safety: a row is skipped if an existing gym has the same normalized\n-- name and is within about 170 m, or has the same normalized name, city, country.\n${unavailableNote}\nwith incoming (name, city, state, country, cc, brand, latitude, longitude, status, grading_style, normalized_name) as (\nvalues\n${values.join(",\n")}\n)\ninsert into public.gyms (name, city, state, country, cc, brand, latitude, longitude, status, grading_style)\nselect name, city, state, country, cc, brand, latitude, longitude, status, grading_style\nfrom incoming i\nwhere not exists (\n  select 1\n  from public.gyms g\n  where lower(regexp_replace(g.name, '[^a-z0-9]+', '', 'g')) = i.normalized_name\n    and (\n      (g.latitude is not null and g.longitude is not null\n        and abs(g.latitude - i.latitude) < 0.0015\n        and abs(g.longitude - i.longitude) < 0.0015)\n      or (\n        lower(coalesce(g.city, '')) = lower(coalesce(i.city, ''))\n        and lower(coalesce(g.country, '')) = lower(i.country)\n      )\n    )\n);\n\n-- Imported rows: ${gyms.length}\n`;

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, content);
  console.log(`Wrote ${gyms.length} duplicate-safe worldwide gym rows to ${OUTPUT}${unavailableRegions.length ? ` (${unavailableRegions.length} regions can be retried later)` : ""}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
