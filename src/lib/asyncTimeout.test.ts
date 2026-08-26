import { afterEach, describe, expect, it, vi } from "vitest";
import { OperationTimeoutError, withTimeout } from "./asyncTimeout";

describe("withTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns an operation that finishes before the deadline", async () => {
    await expect(withTimeout(Promise.resolve("ready"), 100, "too slow"))
      .resolves.toBe("ready");
  });

  it("rejects a stalled operation with a recognizable timeout", async () => {
    vi.useFakeTimers();
    const pending = withTimeout(
      new Promise<string>(() => {}),
      100,
      "Apple took too long.",
    );
    const assertion = expect(pending).rejects.toMatchObject({
      name: "OperationTimeoutError",
      message: "Apple took too long.",
    });
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(new OperationTimeoutError("x")).toBeInstanceOf(Error);
  });
});
