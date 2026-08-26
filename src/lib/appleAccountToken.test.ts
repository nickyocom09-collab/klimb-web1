import { describe, expect, it } from "vitest";
import {
  appleAccountTokensMatch,
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
});
