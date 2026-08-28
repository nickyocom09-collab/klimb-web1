import { describe, expect, it } from "vitest";
import {
  AppleSubscriptionOwnershipError,
  appleAccountTokensMatch,
  decideAppleSubscriptionOwner,
  normalizeAppleAccountToken,
} from "../../supabase/functions/_shared/apple-account-token";

describe("Apple account token binding", () => {
  it("accepts Apple's uppercase UUID for the same Klimb account", () => {
    expect(
      appleAccountTokensMatch(
        "A4D819C5-28A6-4D78-A360-BECFF281E126",
        "a4d819c5-28a6-4d78-a360-becff281e126",
      ),
    ).toBe(true);
  });

  it("does not match a purchase from another Klimb account", () => {
    expect(
      appleAccountTokensMatch(
        "a4d819c5-28a6-4d78-a360-becff281e126",
        "b963b8a8-5561-4a77-af87-985e67ca9a88",
      ),
    ).toBe(false);
  });

  it("stores a canonical lowercase token", () => {
    expect(
      normalizeAppleAccountToken(
        "  A4D819C5-28A6-4D78-A360-BECFF281E126  ",
      ),
    ).toBe("a4d819c5-28a6-4d78-a360-becff281e126");
  });

  it("lets an authenticated account claim a legacy transaction once", () => {
    expect(
      decideAppleSubscriptionOwner({
        signedAccountToken: null,
        expectedUserId: "A4D819C5-28A6-4D78-A360-BECFF281E126",
        claimedUserId: null,
      }),
    ).toBe("a4d819c5-28a6-4d78-a360-becff281e126");
  });

  it("reuses a persisted claim for tokenless renewal notifications", () => {
    expect(
      decideAppleSubscriptionOwner({
        signedAccountToken: null,
        expectedUserId: null,
        claimedUserId: "A4D819C5-28A6-4D78-A360-BECFF281E126",
      }),
    ).toBe("a4d819c5-28a6-4d78-a360-becff281e126");
  });

  it("never lets a second Klimb account steal an existing claim", () => {
    expect(() =>
      decideAppleSubscriptionOwner({
        signedAccountToken: null,
        expectedUserId: "b963b8a8-5561-4a77-af87-985e67ca9a88",
        claimedUserId: "a4d819c5-28a6-4d78-a360-becff281e126",
      }),
    ).toThrowError(AppleSubscriptionOwnershipError);
  });

  it("rejects a signed Apple token for a different signed-in account", () => {
    expect(() =>
      decideAppleSubscriptionOwner({
        signedAccountToken: "a4d819c5-28a6-4d78-a360-becff281e126",
        expectedUserId: "b963b8a8-5561-4a77-af87-985e67ca9a88",
        claimedUserId: null,
      }),
    ).toThrowError(AppleSubscriptionOwnershipError);
  });
});
