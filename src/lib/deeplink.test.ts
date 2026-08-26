import { describe, expect, it } from "vitest";
import { friendRequestPath, friendRequestProfileId } from "./deeplink";

const ID = "123e4567-e89b-12d3-a456-426614174000";

describe("friend request deep links", () => {
  it("parses the public QR link", () => {
    expect(friendRequestProfileId(
      `https://klimb-privacy.vercel.app/add.html?id=${ID}`,
    )).toBe(ID);
  });

  it("parses the custom-scheme fallback", () => {
    expect(friendRequestProfileId(`klimb://profile/${ID}`)).toBe(ID);
  });

  it("routes directly to the friend-request action", () => {
    expect(friendRequestPath(ID)).toBe(`/u/${ID}?friendRequest=1`);
  });

  it("rejects untrusted hosts and malformed identifiers", () => {
    expect(friendRequestProfileId(
      `https://example.com/add.html?id=${ID}`,
    )).toBeNull();
    expect(friendRequestProfileId(
      "klimb://profile/not-a-profile-id",
    )).toBeNull();
    expect(friendRequestPath("../../settings")).toBeNull();
  });
});
