import { describe, expect, it } from "vitest";
import { notificationDestination } from "./notificationDestination";

const ID = "123e4567-e89b-12d3-a456-426614174000";

describe("notificationDestination", () => {
  it("accepts the notification routes the app supports", () => {
    expect(notificationDestination(`/u/${ID}`)).toBe(`/u/${ID}`);
    expect(notificationDestination(`/route/${ID}`)).toBe(`/route/${ID}`);
    expect(notificationDestination(`/stats?recap=${ID}`)).toBe(
      `/stats?recap=${ID}`,
    );
    expect(notificationDestination("/friends/manage")).toBe(
      "/friends/manage",
    );
  });

  it("keeps malformed or external links inside the notification center", () => {
    expect(notificationDestination("https://example.com/phish")).toBe(
      "/notifications",
    );
    expect(notificationDestination("//example.com/phish")).toBe(
      "/notifications",
    );
    expect(notificationDestination(`/u/${ID}?redirect=https://example.com`)).toBe(
      "/notifications",
    );
    expect(notificationDestination(null)).toBe("/notifications");
  });
});
