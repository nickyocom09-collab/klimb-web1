import { describe, expect, it } from "vitest";
import type { RecapPayload } from "./database.types";
import { friendInviteText, friendInviteUrl } from "./friendInvite";
import { archetypeFor } from "./weeklyRecapArchetype";

const BASE_RECAP: RecapPayload = {
  climbs: 12,
  sends: 10,
  flashes: 4,
  attempts: 17,
  sessions: 3,
  streak: 2,
  hardest_send: { boulder: 4, toprope: null, lead: null },
  hardest_flash: { boulder: 3, toprope: null, lead: null },
  new_grades: [],
  pyramid: [{ type: "boulder", ordinal: 4, count: 5 }],
  prev: { climbs: 9, sends: 7 },
  top_wall: "Slab",
  top_color: "Green",
  projects_open: 1,
  oldest_project_days: null,
  flash_rate: 40,
  type_counts: { boulder: 12, toprope: 0, lead: 0 },
};

describe("friend invitations", () => {
  it("keeps the link inline so Messages does not receive an HTML attachment", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    const text = friendInviteText({ id, display_name: "Scott", username: "scott" });

    expect(text).toBe(`Add me on Klimb! 🧗 ${friendInviteUrl(id)}`);
    expect(text).not.toContain("\n");
    expect(text).not.toContain("<html");
  });

  it("URL-encodes the profile identifier", () => {
    expect(friendInviteUrl("profile/with spaces")).toContain("profile%2Fwith%20spaces");
  });
});

describe("weekly recap copy", () => {
  it("is deterministic for the same recorded statistics", () => {
    const results = new Set(
      Array.from({ length: 250 }, () => JSON.stringify(archetypeFor(BASE_RECAP))),
    );
    expect(results.size).toBe(1);
  });

  it("explains the selected archetype with real recap values", () => {
    const result = archetypeFor(BASE_RECAP);
    expect(result.sub).toMatch(/\d/);
    expect(result.sub).not.toMatch(/random/i);
  });
});
