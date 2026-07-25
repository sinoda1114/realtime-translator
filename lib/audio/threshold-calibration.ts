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
 * Multiple of the measured noise floor that counts as speech.
 *
 * Was 3x on first attempt, which measured on-device as a no-op: the room's
 * noise floor read ~0.002 while speech read ~0.0056, so 3x landed at 0.006 —
 * above the speech it was supposed to detect, and identical to the fixed
 * default it replaced. The usable signal-to-noise gap on that phone is only
 * ~2.8x, so the start threshold has to sit well inside it.
 */
const START_MULTIPLIER = 2;

/**
 * Multiple of the noise floor below which speech is considered over.
 *
 * Derived from the noise floor directly rather than as a fraction of the
 * start threshold. The earlier "half of start" rule could place the stop
 * threshold *below* ambient noise — and RMS never drops below the room's own
 * noise, so the detector would sit in "speaking" forever and never finalize
 * an utterance. Keeping this above 1.0 guarantees the level is reachable
 * during a real pause.
 */
const STOP_MULTIPLIER = 1.3;

/**
 * Ceiling for the stop threshold relative to the start threshold. Preserves
 * hysteresis (stop must stay meaningfully under start) in the clamped case,
 * where start was capped and the floor-derived stop could otherwise exceed
 * it.
 */
const MAX_STOP_RATIO_OF_START = 0.8;

/** Mirrors MIN_START_THRESHOLD's purpose for the stop side. */
const MIN_STOP_THRESHOLD = 0.0008;

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
    Math.max(MIN_START_THRESHOLD, noiseFloor * START_MULTIPLIER),
  );
  const stopThreshold = Math.max(
    MIN_STOP_THRESHOLD,
    Math.min(noiseFloor * STOP_MULTIPLIER, startThreshold * MAX_STOP_RATIO_OF_START),
  );

  return { startThreshold, stopThreshold };
}
