#!/usr/bin/env node
/**
 * Builds a reviewed, idempotent SQL seed from OpenStreetMap's public data.
 *
 * Source: © OpenStreetMap contributors, ODbL 1.0.
 * This intentionally targets named artificial climbing facilities only. It
 * excludes natural crags and uses U.S. state polygons to reject neighbouring
 * Canadian and Mexican results returned by the broad Overpass search boxes.
 *
 * Run: node scripts/build-osm-us-gym-seed.mjs
 * Output: migrations/0011_seed_osm_us_climbing_gyms.sql
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const OUTPUT = resolve(process.cwd(), process.argv[2] ?? "migrations/0011_seed_osm_us_climbing_gyms.sql");
const OVERPASS = "https://overpass.openstreetmap.fr/api/interpreter";
const STATE_POLYGONS = "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json";

// Broad regions keep each public Overpass request small enough to be polite and
// reliable. State-polygon filtering below removes the overlap and non-U.S. rows.
const REGIONS = [
  "24,-125,38,-102", // West + Southwest
  "36,-105,49.2,-80", // Midwest
  "37,-82,49.2,-66", // Northeast
  "24,-91,39,-75", // South + Southeast
  "51,-180,72,-129", // Alaska
  "18,-161,23,-154", // Hawaii
  "17,-68,19,-65", // Puerto Rico
];

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const execFileAsync = promisify(execFile);

function normalise(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
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

function stateForPoint(point, features) {
  for (const feature of features) {
    const geometry = feature.geometry;
    const inState = geometry.type === "Polygon"
      ? pointInPolygon(point, geometry.coordinates)
      : geometry.coordinates.some((polygon) => pointInPolygon(point, polygon));
    if (inState) return feature.properties.name;
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
    nwr["sport"="climbing"]["leisure"~"sports_centre|sports_hall|fitness_centre"](${bbox});
    out tags center;`;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.json();
}

async function fetchOverpass(query) {
  // curl is deliberately used for Overpass: the public endpoint accepts its
  // form encoding reliably, whereas generic Node fetch requests are blocked by
  // some CDN edges with a 403.
  const { stdout } = await execFileAsync("curl", [
    "--fail",
    "--silent",
    "--show-error",
    "--max-time",
    "180",
    "-G",
    OVERPASS,
    "--data-urlencode",
    `data=${query}`,
  ], { maxBuffer: 25 * 1024 * 1024 });
  return JSON.parse(stdout);
}

async function main() {
  const stateGeoJson = await fetchJson(STATE_POLYGONS);
  const elements = [];
  for (const bbox of REGIONS) {
    console.log(`Fetching ${bbox}…`);
    const data = await fetchOverpass(overpassQuery(bbox));
    elements.push(...(data.elements ?? []));
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
    if (!tags.name || !point || tags.natural || ["crag", "area", "route"].includes(tags.climbing)) continue;
    const state = stateForPoint(point, stateGeoJson.features);
    if (!state) continue;

    const [longitude, latitude] = point;
    const city = tags["addr:city"] ?? tags["addr:place"] ?? null;
    // Same branded location may appear as a node and an outline. Coordinates
    // within ~11 m are treated as one gym before the SQL is generated.
    const key = `${normalise(tags.name)}|${Math.round(latitude * 10_000)}|${Math.round(longitude * 10_000)}`;
    if (seenGym.has(key)) continue;
    seenGym.add(key);
    gyms.push({ name: tags.name.trim(), city, state, latitude, longitude });
  }

  gyms.sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name));
  const values = gyms.map((gym) => `  (${sql(gym.name)}, ${sql(gym.city)}, ${sql(gym.state)}, 'United States', 'us', null, ${sql(gym.latitude)}, ${sql(gym.longitude)}, 'approved', 'classic', ${sql(normalise(gym.name))})`);
  const content = `-- Klimb — U.S. indoor climbing gym base, generated ${new Date().toISOString().slice(0, 10)}\n-- Source: © OpenStreetMap contributors, available under the ODbL 1.0.\n-- Generated with scripts/build-osm-us-gym-seed.mjs. Do not hand-edit; rerun the\n-- script to refresh. Natural crags are excluded.\n--\n-- Duplicate safety: a row is skipped if an existing gym has the same normalized\n-- name and is within about 170 m, or has the same normalized name, city, and state.\n\nwith incoming (name, city, state, country, cc, brand, latitude, longitude, status, grading_style, normalized_name) as (\nvalues\n${values.join(",\n")}\n)\ninsert into public.gyms (name, city, state, country, cc, brand, latitude, longitude, status, grading_style)\nselect name, city, state, country, cc, brand, latitude, longitude, status, grading_style\nfrom incoming i\nwhere not exists (\n  select 1\n  from public.gyms g\n  where lower(regexp_replace(g.name, '[^a-z0-9]+', '', 'g')) = i.normalized_name\n    and (\n      (g.latitude is not null and g.longitude is not null\n        and abs(g.latitude - i.latitude) < 0.0015\n        and abs(g.longitude - i.longitude) < 0.0015)\n      or (\n        lower(coalesce(g.city, '')) = lower(coalesce(i.city, ''))\n        and lower(coalesce(g.state, '')) = lower(i.state)\n      )\n    )\n);\n\n-- Imported rows: ${gyms.length}\n`;

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, content);
  console.log(`Wrote ${gyms.length} duplicate-safe U.S. gym rows to ${OUTPUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
