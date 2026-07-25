import { describe, expect, test, vi } from "vitest";
import { SilenceDetector } from "@/lib/audio/silence-detector";

const START_THRESHOLD = 0.05;
const STOP_THRESHOLD = 0.03;
const SILENCE_DURATION_MS = 900;

function createDetector(overrides?: { onSpeechStart?: () => void; onFinalize?: () => void }) {
  return new SilenceDetector({
    startThreshold: START_THRESHOLD,
    stopThreshold: STOP_THRESHOLD,
    silenceDurationMs: SILENCE_DURATION_MS,
    ...overrides,
  });
}

describe("SilenceDetector", () => {
  test("stays listening while volume is below the start threshold", () => {
    const detector = createDetector();

    detector.update(0.01, 0);
    detector.update(0.01, 100);

    expect(detector.getState()).toBe("listening");
  });

  test("transitions to speaking once volume crosses the start threshold", () => {
    const onSpeechStart = vi.fn();
    const detector = createDetector({ onSpeechStart });

    detector.update(0.1, 0);

    expect(detector.getState()).toBe("speaking");
    expect(onSpeechStart).toHaveBeenCalledTimes(1);
  });

  test("finalizes an utterance after 900ms of continuous silence", () => {
    const onFinalize = vi.fn();
    const detector = createDetector({ onFinalize });

    detector.update(0.1, 0); // speaking
    detector.update(0.01, 100); // silence_pending starts at t=100
    detector.update(0.01, 999); // 899ms elapsed, not yet finalized
    expect(onFinalize).not.toHaveBeenCalled();

    detector.update(0.01, 1000); // 900ms elapsed, finalize
    expect(onFinalize).toHaveBeenCalledTimes(1);
    expect(detector.getState()).toBe("listening");
  });

  test("cancels the finalize timer when speech resumes during silence_pending", () => {
    const onFinalize = vi.fn();
    const detector = createDetector({ onFinalize });

    detector.update(0.1, 0); // speaking
    detector.update(0.01, 100); // silence_pending
    detector.update(0.1, 500); // speech resumes before 900ms elapsed
    detector.update(0.01, 600); // silence_pending again, restarts the clock at t=600
    detector.update(0.01, 1400); // only 800ms since the restart, should not finalize yet

    expect(onFinalize).not.toHaveBeenCalled();
    expect(detector.getState()).toBe("silence_pending");

    detector.update(0.01, 1500); // 900ms since restart
    expect(onFinalize).toHaveBeenCalledTimes(1);
  });

  test("flush finalizes immediately while speaking", () => {
    const onFinalize = vi.fn();
    const detector = createDetector({ onFinalize });

    detector.update(0.1, 0);
    detector.flush();

    expect(onFinalize).toHaveBeenCalledTimes(1);
    expect(detector.getState()).toBe("listening");
  });

  test("flush finalizes immediately while silence_pending", () => {
    const onFinalize = vi.fn();
    const detector = createDetector({ onFinalize });

    detector.update(0.1, 0);
    detector.update(0.01, 100);
    detector.flush();

    expect(onFinalize).toHaveBeenCalledTimes(1);
  });

  test("flush does nothing while already listening", () => {
    const onFinalize = vi.fn();
    const detector = createDetector({ onFinalize });

    detector.flush();

    expect(onFinalize).not.toHaveBeenCalled();
  });

  test("reset returns the detector to the listening state", () => {
    const detector = createDetector();

    detector.update(0.1, 0);
    detector.reset();

    expect(detector.getState()).toBe("listening");
  });
});
