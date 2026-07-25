import { describe, expect, test } from "vitest";
import {
  calibrateThresholds,
  DEFAULT_START_THRESHOLD,
  DEFAULT_STOP_THRESHOLD,
  MIN_START_THRESHOLD,
} from "@/lib/audio/threshold-calibration";

describe("calibrateThresholds", () => {
  test("falls back to the fixed defaults when there are no samples", () => {
    expect(calibrateThresholds([])).toEqual({
      startThreshold: DEFAULT_START_THRESHOLD,
      stopThreshold: DEFAULT_STOP_THRESHOLD,
    });
  });

  // The exact on-device numbers this exists for: noise floor ~0.002, speech
  // ~0.0056 — a signal-to-noise gap of only ~2.8x. The first attempt used a
  // 3x multiplier, which landed at 0.006: above the speech it was meant to
  // detect, and identical to the fixed default, so calibration was a no-op.
  test("lands between the noise floor and speech on the real device's numbers", () => {
    const measuredRoom = [0.0019, 0.002, 0.0021, 0.002, 0.002];

    const { startThreshold, stopThreshold } = calibrateThresholds(measuredRoom);

    expect(startThreshold).toBeCloseTo(0.004, 5); // 0.002 median * 2
    expect(startThreshold).toBeLessThan(0.0056); // speech clears it
    expect(startThreshold).toBeLessThan(DEFAULT_START_THRESHOLD);
    // Crucially above the noise floor — RMS never drops below the room's own
    // noise, so a stop threshold under it would never be reached.
    expect(stopThreshold).toBeGreaterThan(0.002);
    expect(stopThreshold).toBeLessThan(startThreshold);
  });

  test("lowers the threshold for a quiet room so normal speech clears it", () => {
    const quietRoom = [0.0008, 0.001, 0.0009, 0.0011, 0.001];

    const { startThreshold, stopThreshold } = calibrateThresholds(quietRoom);

    expect(startThreshold).toBeCloseTo(0.002, 5); // 0.001 median * 2
    expect(startThreshold).toBeLessThan(DEFAULT_START_THRESHOLD);
    expect(stopThreshold).toBeCloseTo(0.0013, 5); // 0.001 * 1.3
    expect(stopThreshold).toBeGreaterThan(0.001); // still above the floor
  });

  // The failure mode that made the first calibration attempt useless even
  // where it did lower the threshold: a stop threshold under ambient noise is
  // unreachable, so the detector stays in "speaking" forever and no utterance
  // is ever finalized.
  test("keeps the stop threshold above the noise floor across a range of rooms", () => {
    for (const floor of [0.0005, 0.001, 0.002, 0.0028]) {
      const { stopThreshold } = calibrateThresholds([floor, floor, floor]);
      expect(stopThreshold).toBeGreaterThan(floor);
    }
  });

  // Safety property: calibration may only ever increase sensitivity. If the
  // user talks during the calibration window the measured "floor" is really
  // speech, and without this clamp the threshold would land above normal
  // conversation — worse than the fixed default it replaced.
  test("never raises the threshold above the fixed default", () => {
    const talkingDuringCalibration = [0.02, 0.03, 0.025, 0.028, 0.022];

    const { startThreshold, stopThreshold } = calibrateThresholds(talkingDuringCalibration);

    expect(startThreshold).toBe(DEFAULT_START_THRESHOLD);
    // Hysteresis is preserved even in this clamped case: the floor-derived
    // stop would exceed the capped start, so it falls back to a ratio of it.
    expect(stopThreshold).toBeLessThan(startThreshold);
    expect(stopThreshold).toBeCloseTo(DEFAULT_START_THRESHOLD * 0.8, 10);
  });

  // A near-silent digital input would otherwise calibrate to ~0, making 8-bit
  // quantization noise register as speech and finalize an utterance forever.
  test("never lowers the threshold below the safety floor", () => {
    const nearSilence = [0, 0.00001, 0, 0.00002, 0];

    const { startThreshold } = calibrateThresholds(nearSilence);

    expect(startThreshold).toBe(MIN_START_THRESHOLD);
  });

  // Median over mean: one transient must not drag the floor upward, which
  // would leave the threshold too high for the rest of the session.
  test("ignores a single loud transient in the calibration window", () => {
    const quietWithOneBang = [0.001, 0.001, 0.05, 0.001, 0.001];

    const { startThreshold } = calibrateThresholds(quietWithOneBang);

    expect(startThreshold).toBeCloseTo(0.002, 5); // median 0.001, unaffected by the 0.05
  });

  test("keeps the stop threshold meaningfully under the start threshold", () => {
    const { startThreshold, stopThreshold } = calibrateThresholds([0.0005, 0.0006, 0.0005]);

    expect(stopThreshold).toBeLessThan(startThreshold);
    expect(stopThreshold).toBeGreaterThan(0.0005); // and still above the floor
  });
});
