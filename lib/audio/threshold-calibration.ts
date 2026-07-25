/**
 * Derives speech-detection thresholds from a short sample of ambient room
 * noise, instead of using one hard-coded pair for every device.
 *
 * Why: the fixed defaults (0.006 / 0.003) were tuned on one phone, and on
 * another real device normal conversation measured 0.0053–0.0066 — right at
 * or below the start threshold. The result was that speech never registered,
 * transcription deltas accumulated for the entire session without a single
 * utterance boundary being detected, and no translation ever appeared.
 * Microphone gain varies enough between devices that a single constant
 * cannot work for all of them.
 */

export const DEFAULT_START_THRESHOLD = 0.006;
export const DEFAULT_STOP_THRESHOLD = 0.003;

/** How long to listen to the room before deciding on thresholds. */
export const CALIBRATION_DURATION_MS = 1500;

/**
 * Floor for the calibrated start threshold. Below this, quantization noise
 * in an 8-bit time-domain buffer (and plain DC offset) can register as
 * speech, which would finalize an "utterance" every silence-duration window
 * forever.
 */
export const MIN_START_THRESHOLD = 0.0015;

/**
 * Multiple of the measured noise floor that counts as speech. Speech RMS on
 * the affected device sat ~3-4x above its noise floor, so 3x separates the
 * two without demanding the loudness the old fixed default did.
 */
const NOISE_FLOOR_MULTIPLIER = 3;

/** Speech is considered over below half the level that started it — the
 * same 2:1 ratio the original fixed pair used, preserving its hysteresis. */
const STOP_RATIO = 0.5;

export interface CalibratedThresholds {
  startThreshold: number;
  stopThreshold: number;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

/**
 * Computes thresholds from ambient-noise RMS samples.
 *
 * Deliberately one-directional: the result is clamped to never exceed the
 * fixed defaults, so calibration can only ever make detection *more*
 * sensitive. That makes the worst case safe — if the user happens to talk
 * during the calibration window, the noise floor reads high, the clamp caps
 * it, and behaviour is simply the old fixed-threshold behaviour rather than
 * something worse than before.
 */
export function calibrateThresholds(samples: readonly number[]): CalibratedThresholds {
  if (samples.length === 0) {
    return {
      startThreshold: DEFAULT_START_THRESHOLD,
      stopThreshold: DEFAULT_STOP_THRESHOLD,
    };
  }

  // Median, not mean: a single cough, door slam, or notification chime during
  // the window would drag a mean far above the true noise floor.
  const noiseFloor = median(samples);
  const startThreshold = Math.min(
    DEFAULT_START_THRESHOLD,
    Math.max(MIN_START_THRESHOLD, noiseFloor * NOISE_FLOOR_MULTIPLIER),
  );

  return {
    startThreshold,
    stopThreshold: startThreshold * STOP_RATIO,
  };
}
