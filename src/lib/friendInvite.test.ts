import { describe, expect, it } from "vitest";
import { friendInviteText, friendInviteUrl } from "./friendInvite";

const ID = "123e4567-e89b-12d3-a456-426614174000";

describe("friend invitations", () => {
  it("uses the public HTTPS landing page for links and QR codes", () => {
    expect(friendInviteUrl(ID)).toBe(
      `https://klimb-privacy.vercel.app/add.html?id=${ID}`,
    );
  });

  it("includes the same tappable link in the Messages invite", () => {
    expect(
      friendInviteText({ id: ID, display_name: "Alex", username: "alex" }),
    ).toContain(friendInviteUrl(ID));
  });
});
