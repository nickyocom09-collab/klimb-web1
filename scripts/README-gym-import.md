# Gym directory importer (for Codex)

One-pass tool to fill in every US indoor climbing gym and clean duplicates.
Runs on the Mac (needs real network access, which the Klimb assistant sandbox
doesn't have). No npm deps, no secret keys.

## What it does
1. Fetches all 50 states + DC from `indoorclimbing.com/<state>.html`.
2. Parses each gym (name + street address).
3. Geocodes each address via OpenStreetMap Nominatim (cached, ~1/sec).
4. Skips non-gyms (university / YMCA / rec-center walls) via a blocklist.
5. Writes `scripts/gym-import.sql` — dedupe-safe `INSERT`s plus the
   `gym-dedupe.sql` cleanup appended.

## Run it
```bash
cd "/Users/nickyocom/Desktop/claude website/klimb-web"
node scripts/import-gyms.mjs        # ~15-20 min first run (geocoding); resumable
```
It prints per-state candidate counts and writes `scripts/gym-import.sql`.

## Apply it
Open the file, skim it, then run it against Supabase (project
`qanfxjjiegqdmhmgwtxl`):
- **Supabase Dashboard → SQL Editor → paste `gym-import.sql` → Run**, or
- `psql "$DATABASE_URL" -f scripts/gym-import.sql` if you have the connection string.

Everything is written so re-running is safe:
- inserts skip any gym within 250 m of an existing one or with the same
  normalized name+city;
- the cleanup merges accent/name variants and rebrands, re-pointing routes and
  home/visiting-gym references before deleting, so no user data is lost.

## Verify
The SQL ends with a sanity `SELECT` — `overlapping_pairs` should be `0`.
Spot-check a few states in the app's map afterward.

## Tuning
- Non-gym filter: edit the `NON_GYM` regex in `import-gyms.mjs`.
- Nominatim requires the 1 req/sec limit + User-Agent already set — don't remove
  them or the imports get rate-limited/blocked.
- Gyms load from Supabase at runtime, so new rows appear in the app immediately —
  no TestFlight build needed for gym data.
