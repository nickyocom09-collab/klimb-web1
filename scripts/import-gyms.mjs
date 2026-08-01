#!/usr/bin/env node
/**
 * Klimb — US gym directory importer.
 *
 * Pulls every US state's gym list from indoorclimbing.com, geocodes each
 * address via OpenStreetMap Nominatim, filters out non-gyms (university /
 * YMCA / rec-center walls), and writes ONE reviewable SQL file:
 *
 *     scripts/gym-import.sql
 *
 * The SQL is dedupe-safe by construction — every INSERT is skipped if an
 * approved gym already exists within 250 m or with the same normalized
 * name+city — and it ends with the same variant/rebrand dedupe cleanup Klimb
 * uses. Apply it in the Supabase SQL Editor (project qanfxjjiegqdmhmgwtxl) or
 * with the Supabase CLI. Nothing here touches the database directly and no
 * secret keys are needed.
 *
 * Run:   node scripts/import-gyms.mjs
 * Then:  paste scripts/gym-import.sql into Supabase → SQL Editor → Run.
 *
 * Requires Node 18+ (global fetch). No npm dependencies.
 *
 * NOTE for the operator (Codex): geocoding 700+ addresses at ~1/sec takes
 * ~15-20 min. Results are cached in scripts/geocode-cache.json, so re-runs are
 * fast and safe to resume. Nominatim's usage policy requires the 1 req/sec
 * rate limit and a real User-Agent — both are set below; don't remove them.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = join(__dir, "geocode-cache.json");
const OUT_PATH = join(__dir, "gym-import.sql");

// indoorclimbing.com uses lowercase, punctuation-free filenames.
const STATES = {
  AL: "alabama", AK: "alaska", AZ: "arizona", AR: "arkansas", CA: "california",
  CO: "colorado", CT: "connecticut", DE: "delaware", FL: "florida", GA: "georgia",
  HI: "hawaii", ID: "idaho", IL: "illinois", IN: "indiana", IA: "iowa",
  KS: "kansas", KY: "kentucky", LA: "louisiana", ME: "maine", MD: "maryland",
  MA: "massachusetts", MI: "michigan", MN: "minnesota", MS: "mississippi",
  MO: "missouri", MT: "montana", NE: "nebraska", NV: "nevada", NH: "newhampshire",
  NJ: "newjersey", NM: "newmexico", NY: "newyork", NC: "northcarolina",
  ND: "northdakota", OH: "ohio", OK: "oklahoma", OR: "oregon", PA: "pennsylvania",
  RI: "rhodeisland", SC: "southcarolina", SD: "southdakota", TN: "tennessee",
  TX: "texas", UT: "utah", VT: "vermont", VA: "virginia", WA: "washington",
  WV: "westvirginia", WI: "wisconsin", WY: "wyoming", DC: "districtofcolumbia",
};

// Skip campus / community walls — Klimb is commercial indoor gyms.
const NON_GYM = /(university|college|\bu of\b|\buniv\b|campus|student rec|recreation center|rec center|\bymca\b|jewish community|\bjcc\b|community center|fieldhouse|field house|high school|middle school|county park|state park|air force|army|navy|fitness center at)/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&#039;/g, "'")
    .replace(/&rsquo;/g, "'").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"')
    .replace(/&ndash;/g, "-").replace(/&mdash;/g, "-").trim();
}

/** Parse an indoorclimbing.com state page into {name, address} rows. Gym names
 *  are bold; the line right after is the street address. We normalize the HTML
 *  to newline-delimited text with bold markers so we don't depend on a parser. */
function parseState(html) {
  const text = html
    .replace(/\r/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<(strong|b)>([\s\S]*?)<\/(strong|b)>/gi, "$2")
    .replace(/<[^>]+>/g, "")
    .split("\n")
    .map((l) => decodeEntities(l))
    .filter((l, i, a) => l.length || a[i - 1]?.length);

  const rows = [];
  for (let i = 0; i < text.length; i++) {
    const m = text[i].match(/^(.+?)$/);
    if (!m) continue;
    const name = m[1].trim();
    // First following non-empty line that looks like a US street address.
    let addr = "";
    for (let j = i + 1; j < Math.min(i + 4, text.length); j++) {
      const line = text[j].replace(//g, "").trim();
      if (/\b[A-Z]{2}\b[ ,]*\d{5}/.test(line) || /,\s*[A-Za-z .]+,\s*[A-Za-z]/.test(line)) {
        addr = line;
        break;
      }
    }
    if (name && addr) rows.push({ name, address: addr });
  }
  return rows;
}

/** "830 S. Ronald Reagan Blvd., Longwood, FL 32750" -> {city:"Longwood"} */
function cityFrom(address, stateCode) {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  // Last part is usually "FL 32750"; the one before it is the city.
  for (let i = parts.length - 1; i >= 0; i--) {
    if (new RegExp(`\\b${stateCode}\\b`, "i").test(parts[i]) && i > 0) {
      return parts[i - 1].replace(/\b\d{5}(-\d{4})?\b/, "").trim();
    }
  }
  return parts.length >= 2 ? parts[parts.length - 2] : "";
}

const cache = existsSync(CACHE_PATH)
  ? JSON.parse(readFileSync(CACHE_PATH, "utf8"))
  : {};

async function geocode(address) {
  if (cache[address] !== undefined) return cache[address];
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=" +
    encodeURIComponent(address);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "KlimbGymImporter/1.0 (realklimb@gmail.com)" },
    });
    const data = await res.json();
    const hit = data?.[0]
      ? { lat: +(+data[0].lat).toFixed(5), lng: +(+data[0].lon).toFixed(5) }
      : null;
    cache[address] = hit;
  } catch {
    cache[address] = null;
  }
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 0));
  await sleep(1100); // Nominatim: max 1 request/second.
  return cache[address];
}

const sqlStr = (s) => "'" + String(s).replace(/'/g, "''") + "'";

async function main() {
  const values = [];
  let scanned = 0, geocoded = 0, skipped = 0;

  for (const [code, file] of Object.entries(STATES)) {
    let html;
    try {
      const res = await fetch(`https://www.indoorclimbing.com/${file}.html`, {
        headers: { "User-Agent": "KlimbGymImporter/1.0 (realklimb@gmail.com)" },
      });
      if (!res.ok) { console.warn(`skip ${code}: HTTP ${res.status}`); continue; }
      html = await res.text();
    } catch (e) {
      console.warn(`skip ${code}: ${e.message}`);
      continue;
    }

    const rows = parseState(html);
    console.log(`${code}: ${rows.length} candidates`);
    for (const { name, address } of rows) {
      scanned++;
      if (NON_GYM.test(name)) { skipped++; continue; }
      const city = cityFrom(address, code);
      const geo = await geocode(`${name}, ${address}`);
      const point = geo || (await geocode(address));
      if (!point) { skipped++; continue; }
      geocoded++;
      values.push(
        `  (${sqlStr(name)}, ${sqlStr(city)}, ${sqlStr(code)}, ${point.lat}, ${point.lng})`,
      );
    }
  }

  const header = `-- Klimb gym import — generated ${new Date().toISOString()}
-- ${geocoded} geocoded gyms (${scanned} scanned, ${skipped} skipped as non-gym / ungeocodable).
-- Dedupe-safe: skips anything within 250 m of an existing approved gym or with
-- the same normalized name+city. Review, then run in the Supabase SQL Editor.

INSERT INTO gyms (name, city, state, country, cc, latitude, longitude, status, grading_style)
SELECT c.name, c.city, c.state, 'United States', 'us', c.lat, c.lng, 'approved', 'classic'
FROM (VALUES
${values.join(",\n")}
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
`;

  const cleanup = readFileSync(join(__dir, "gym-dedupe.sql"), "utf8");
  writeFileSync(OUT_PATH, header + "\n" + cleanup);
  console.log(`\nWrote ${OUT_PATH} — ${geocoded} gyms. Review then run in Supabase.`);
}

main();
