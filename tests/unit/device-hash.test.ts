import { describe, expect, test } from "vitest";
import { hashDeviceId } from "@/lib/security/device-hash";

describe("hashDeviceId", () => {
  test("produces the same hash for the same input and salt", () => {
    const a = hashDeviceId("device-1", "salt-a");
    const b = hashDeviceId("device-1", "salt-a");

    expect(a).toBe(b);
  });

  test("produces a different hash for a different device id", () => {
    const a = hashDeviceId("device-1", "salt-a");
    const b = hashDeviceId("device-2", "salt-a");

    expect(a).not.toBe(b);
  });

  test("produces a different hash for a different salt", () => {
    const a = hashDeviceId("device-1", "salt-a");
    const b = hashDeviceId("device-1", "salt-b");

    expect(a).not.toBe(b);
  });

  test("does not return the raw device id", () => {
    const hash = hashDeviceId("device-1", "salt-a");

    expect(hash).not.toContain("device-1");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
