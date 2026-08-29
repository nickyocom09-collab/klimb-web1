// @vitest-environment happy-dom

import { useCallback, useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProOfferSheet } from "./ProOfferSheet";

const authMock = vi.hoisted(() => ({
  current: null as null | (() => unknown),
}));

const entitlementMock = vi.hoisted(() => ({
  hasProAccess: false,
  monthlyProduct: null,
  purchaseState: "idle",
  error: null,
  restorePurchases: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock("../lib/auth", () => ({
  useAuth: () => authMock.current?.(),
}));

vi.mock("../lib/entitlements", () => ({
  useEntitlements: () => entitlementMock,
}));

vi.mock("lucide-react", () => ({
  BarChart3: () => <span aria-hidden="true" />,
  X: () => <span aria-hidden="true" />,
}));

function useRefreshingProfile() {
  const [profile, setProfile] = useState({
    id: "new-climber",
    onboarded: true,
    pro_intro_seen_at: null as string | null,
  });
  const updateProfile = useCallback(async (patch: { pro_intro_seen_at?: string }) => {
    setProfile((current) => ({ ...current, ...patch }));
  }, []);
  return { profile, updateProfile };
}

function DiscoveryTabs() {
  return (
    <nav aria-label="Primary">
      <a href="/logbook" onClick={(event) => event.preventDefault()}>
        Logbook
      </a>
      <a href="/map" onClick={(event) => event.preventDefault()}>
        Map
      </a>
    </nav>
  );
}

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
}

describe("ProOfferSheet", () => {
  let animationFrames: FrameRequestCallback[];

  beforeEach(() => {
    vi.useFakeTimers();
    animationFrames = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("localStorage", createMemoryStorage());
    vi.stubGlobal("sessionStorage", createMemoryStorage());
    authMock.current = useRefreshingProfile;
    entitlementMock.trackEvent.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("finishes entering when marking the refreshed profile as seen", async () => {
    render(
      <MemoryRouter>
        <DiscoveryTabs />
        <ProOfferSheet />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Logbook" }));
    fireEvent.click(screen.getByRole("link", { name: "Map" }));

    act(() => {
      vi.advanceTimersByTime(420);
    });
    act(() => {
      animationFrames.shift()?.(0);
      animationFrames.shift()?.(16);
    });

    const dialog = screen.getByRole("dialog");
    const sheet = dialog.querySelector("section");
    expect(sheet).not.toBeNull();
    expect(dialog.className).toContain("bg-black/80");
    expect(sheet?.style.transform).toBe("translate3d(0, 0px, 0)");
    expect(screen.getByText("See what your sessions are building.")).toBeTruthy();
  });
});
