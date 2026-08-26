import assert from "node:assert/strict";
import type { RecapPayload } from "../src/lib/database.types";
import { archetypeFor } from "../src/lib/weeklyRecapArchetype";

function payload(patch: Partial<RecapPayload> = {}): RecapPayload {
  return {
    climbs: 8,
    sends: 5,
    flashes: 1,
    attempts: 12,
    sessions: 2,
    flash_rate: 20,
    top_wall: null,
    top_color: null,
    hardest_send: { boulder: 4, toprope: null, lead: null },
    hardest_flash: { boulder: 3, toprope: null, lead: null },
    type_counts: { boulder: 5, toprope: 0, lead: 0 },
    pyramid: [{ type: "boulder", ordinal: 4, count: 2 }],
    new_grades: [],
    prev: { climbs: 8, sends: 5 },
    projects_open: 0,
    oldest_project_days: null,
    streak: 1,
    ...patch,
  };
}

const tied = payload({
  climbs: 10,
  attempts: 25,
  sessions: 3,
  top_wall: "Roof",
});
const repeated = Array.from({ length: 1_000 }, () =>
  JSON.stringify(archetypeFor(tied)),
);
assert.equal(new Set(repeated).size, 1, "identical stats changed recap copy");
assert.deepEqual(archetypeFor(tied), {
  key: "project",
  label: "Project Hunter",
  sub: "25 attempts across 10 Klimbs.",
  hue: "#E4B363",
});

const flashHeavy = payload({
  climbs: 10,
  sends: 8,
  flashes: 8,
  attempts: 10,
  flash_rate: 80,
});
assert.equal(archetypeFor(flashHeavy).key, "flash");
assert.equal(
  archetypeFor(flashHeavy).sub,
  "8 flashes and a 80% flash rate.",
);

const firstActive = payload({
  climbs: 6,
  prev: { climbs: 0, sends: 0 },
});
assert.equal(archetypeFor(firstActive).key, "fresh");
assert.equal(
  archetypeFor(firstActive).sub,
  "6 climbs in your first active recap.",
);

console.log("Weekly recap determinism: 4 checks passed (1,000 repeat runs).");
