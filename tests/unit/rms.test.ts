import { describe, expect, test } from "vitest";
import { calculateRms } from "@/lib/audio/rms";

describe("calculateRms", () => {
  test("returns 0 for silence (all samples at the 128 midpoint)", () => {
    const silence = new Uint8Array(64).fill(128);
    expect(calculateRms(silence)).toBe(0);
  });

  test("returns 0 for an empty array", () => {
    expect(calculateRms(new Uint8Array(0))).toBe(0);
  });

  test("returns 1 for a full-scale square wave", () => {
    const samples = new Uint8Array([0, 255, 0, 255]);
    expect(calculateRms(samples)).toBeCloseTo(1, 1);
  });

  test("returns a higher value for louder samples than quieter ones", () => {
    const quiet = new Uint8Array([120, 136, 120, 136]);
    const loud = new Uint8Array([64, 192, 64, 192]);

    expect(calculateRms(loud)).toBeGreaterThan(calculateRms(quiet));
  });
});
