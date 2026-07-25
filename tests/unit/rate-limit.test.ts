import { beforeEach, describe, expect, test } from "vitest";
import { checkRateLimit, resetRateLimit } from "@/lib/security/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimit("test-key");
  });

  test("allows requests up to the limit within the window", () => {
    const now = 1_000_000;

    const first = checkRateLimit("test-key", 3, 60_000, now);
    const second = checkRateLimit("test-key", 3, 60_000, now + 1);
    const third = checkRateLimit("test-key", 3, 60_000, now + 2);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(true);
  });

  test("blocks requests once the limit is exceeded within the window", () => {
    const now = 1_000_000;

    checkRateLimit("test-key", 2, 60_000, now);
    checkRateLimit("test-key", 2, 60_000, now + 1);
    const third = checkRateLimit("test-key", 2, 60_000, now + 2);

    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  test("resets the count after the window elapses", () => {
    const now = 1_000_000;

    checkRateLimit("test-key", 1, 60_000, now);
    const blocked = checkRateLimit("test-key", 1, 60_000, now + 1);
    const afterWindow = checkRateLimit("test-key", 1, 60_000, now + 60_001);

    expect(blocked.allowed).toBe(false);
    expect(afterWindow.allowed).toBe(true);
  });

  test("tracks separate keys independently", () => {
    const now = 1_000_000;

    checkRateLimit("key-a", 1, 60_000, now);
    const keyB = checkRateLimit("key-b", 1, 60_000, now);

    expect(keyB.allowed).toBe(true);
  });

  test("bounds memory growth by evicting the oldest bucket once at capacity", () => {
    const now = 1_000_000;

    // Fill well past the internal cap (5,000) with distinct keys.
    for (let i = 0; i < 5_050; i += 1) {
      checkRateLimit(`flood-key-${i}`, 100, 60_000, now);
    }

    // The very first key created should have been evicted, so requesting it
    // again is treated as a fresh bucket (allowed, not still tracked from
    // before) rather than the map growing without bound.
    const result = checkRateLimit("flood-key-0", 100, 60_000, now);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
  });
});
