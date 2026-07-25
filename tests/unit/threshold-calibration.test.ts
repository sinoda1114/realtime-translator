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

  // The real-device case this exists for: a quiet room whose noise floor sits
  // well under the fixed default, where conversation measured 0.0053–0.0066
  // and so never crossed the old 0.006 start threshold.
  test("lowers the threshold for a quiet room so normal speech clears it", () => {
    const quietRoom = [0.0008, 0.001, 0.0009, 0.0011, 0.001];

    const { startThreshold, stopThreshold } = calibrateThresholds(quietRoom);

    expect(startThreshold).toBeCloseTo(0.003, 5); // 0.001 median * 3
    expect(startThreshold).toBeLessThan(DEFAULT_START_THRESHOLD);
    expect(startThreshold).toBeLessThan(0.0053); // clears the observed speech level
    expect(stopThreshold).toBeCloseTo(0.0015, 5);
  });

  // Safety property: calibration may only ever increase sensitivity. If the
  // user talks during the calibration window the measured "floor" is really
  // speech, and without this clamp the threshold would land above normal
  // conversation — worse than the fixed default it replaced.
  test("never raises the threshold above the fixed default", () => {
    const talkingDuringCalibration = [0.02, 0.03, 0.025, 0.028, 0.022];

    const { startThreshold, stopThreshold } = calibrateThresholds(talkingDuringCalibration);

    expect(startThreshold).toBe(DEFAULT_START_THRESHOLD);
    expect(stopThreshold).toBe(DEFAULT_START_THRESHOLD * 0.5);
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

    expect(startThreshold).toBeCloseTo(0.003, 5); // median 0.001, unaffected by the 0.05
  });

  test("keeps the 2:1 start/stop hysteresis ratio", () => {
    const { startThreshold, stopThreshold } = calibrateThresholds([0.0005, 0.0006, 0.0005]);

    expect(stopThreshold).toBeCloseTo(startThreshold / 2, 10);
  });
});
