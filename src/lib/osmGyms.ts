// Worldwide climbing-gym discovery via OpenStreetMap's Overpass API.
//
// The Klimb `gyms` table only holds gyms someone has added. To fill the rest
// of the world with gray "discovery" dots we ask Overpass for climbing
// facilities inside whatever the map is currently showing. Results are cached
// per coarse tile so panning around doesn't re-query the same ground, and
// everything fails soft — if Overpass is unreachable the map simply shows no
// discovery dots.

export type OsmGym = {
  /** Stable OSM id like "node/123" — used for dedupe + React keys. */
  id: string;
  name: string;
  lat: number;
  lng: number;
};

export type Bounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

// Public Overpass mirrors, tried in order until one answers.
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

// Bias toward indoor gyms rather than outdoor crags: named features that are a
// climbing sports-centre / climbing leisure venue, or explicitly indoor.
function query(b: Bounds): string {
  const bbox = `${b.south},${b.west},${b.north},${b.east}`;
  return `[out:json][timeout:25];
(
  nwr["sport"="climbing"]["leisure"~"sports_centre|climbing|fitness_centre"]["name"](${bbox});
  nwr["leisure"="climbing"]["name"](${bbox});
  nwr["climbing"="indoor"]["name"](${bbox});
);
out center 600;`;
}

type OverpassEl = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function parse(elements: OverpassEl[]): OsmGym[] {
  const out: OsmGym[] = [];
  const seen = new Set<string>();
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    const name = el.tags?.name;
    if (lat == null || lng == null || !name) continue;
    const id = `${el.type}/${el.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name, lat, lng });
  }
  return out;
}

/**
 * Fetch climbing gyms inside `bounds`. Tries each Overpass mirror in turn and
 * resolves to `[]` (never throws) if they all fail or the request is aborted.
 */
export async function fetchOsmGyms(
  bounds: Bounds,
  signal?: AbortSignal,
): Promise<OsmGym[]> {
  const body = "data=" + encodeURIComponent(query(bounds));
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal,
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { elements?: OverpassEl[] };
      return parse(json.elements ?? []);
    } catch {
      if (signal?.aborted) return [];
      // try the next mirror
    }
  }
  return [];
}

/** Coarse tile key (~1° cells) so we only query each patch of world once. */
export function tileKeysFor(b: Bounds): string[] {
  const keys: string[] = [];
  const s = Math.floor(b.south);
  const n = Math.floor(b.north);
  const w = Math.floor(b.west);
  const e = Math.floor(b.east);
  for (let y = s; y <= n; y++)
    for (let x = w; x <= e; x++) keys.push(`${y}:${x}`);
  return keys;
}

/** Meters between two lat/lng points (equirectangular — fine at gym scale). */
export function metersBetween(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371000;
  const toRad = Math.PI / 180;
  const x = (bLng - aLng) * toRad * Math.cos(((aLat + bLat) / 2) * toRad);
  const y = (bLat - aLat) * toRad;
  return Math.sqrt(x * x + y * y) * R;
}
