// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProUnlocked } from "./ProUnlocked";

vi.mock("lucide-react", () => ({
  Check: () => <span aria-hidden="true" />,
  Crown: () => <span aria-hidden="true" />,
  Sparkles: () => <span aria-hidden="true" />,
}));

describe("ProUnlocked", () => {
  afterEach(cleanup);

  it("shows the complete scrollable benefit sequence without a feature count", () => {
    render(
      <ProUnlocked
        celebration={{ productId: "klimb.pro.monthly", isTrial: true }}
        onStart={vi.fn()}
      />,
    );

    expect(screen.getByText("Explore what is unlocked")).toBeTruthy();
    expect(screen.getByText("Weekly recap history")).toBeTruthy();
    expect(screen.getByText("Flash rate")).toBeTruthy();
    expect(screen.getByText("Video attachments")).toBeTruthy();
    expect(screen.getByText("Every new Pro insight")).toBeTruthy();
    expect(screen.queryByText(/\d+ features/i)).toBeNull();

    const list = screen.getByRole("list");
    expect(list.className).toContain("overflow-y-auto");
    expect(screen.getAllByRole("listitem")).toHaveLength(12);
  });

  it("starts Klimbing from the confirmation action", () => {
    const onStart = vi.fn();
    render(
      <ProUnlocked
        celebration={{ productId: "klimb.pro.yearly", isTrial: false }}
        onStart={onStart}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Start Klimbing" }));
    expect(onStart).toHaveBeenCalledOnce();
  });
});
