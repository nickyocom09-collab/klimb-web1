import { describe, expect, it } from "vitest";
import { mixFriendActivities } from "./friendFeed";

type Item = { id: string; friend: { id: string } };

describe("friend feed mixing", () => {
  it("keeps every activity and mixes owners", () => {
    const items: Item[] = [
      { id: "a1", friend: { id: "a" } },
      { id: "a2", friend: { id: "a" } },
      { id: "b1", friend: { id: "b" } },
      { id: "b2", friend: { id: "b" } },
      { id: "c1", friend: { id: "c" } },
    ];

    const mixed = mixFriendActivities(items, () => 0);

    expect(mixed.map((item) => item.id).sort()).toEqual(items.map((item) => item.id).sort());
    for (let index = 1; index < mixed.length; index += 1) {
      expect(mixed[index].friend.id).not.toBe(mixed[index - 1].friend.id);
    }
  });

  it("allows repeats only after other owners run out", () => {
    const items: Item[] = [
      { id: "a1", friend: { id: "a" } },
      { id: "a2", friend: { id: "a" } },
      { id: "a3", friend: { id: "a" } },
      { id: "b1", friend: { id: "b" } },
    ];

    const mixed = mixFriendActivities(items, () => 0);
    expect(mixed.slice(0, 2).map((item) => item.friend.id)).toEqual(["a", "b"]);
    expect(mixed.slice(2).map((item) => item.friend.id)).toEqual(["a", "a"]);
  });
});
