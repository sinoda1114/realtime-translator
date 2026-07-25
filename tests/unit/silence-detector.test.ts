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

  // Changed deliberately: when threshold detection never fires the state
  // stays "listening" for the whole session even though audio has been
  // accumulating, and the old "only flush while speaking" rule silently
  // discarded it on stop() / language switch.
  test("flush finalizes even from the listening state", () => {
    const onFinalize = vi.fn();
    const detector = createDetector({ onFinalize });

    detector.flush();

    expect(onFinalize).toHaveBeenCalledOnce();
  });

  test("reset returns the detector to the listening state", () => {
    const detector = createDetector();

    detector.update(0.1, 0);
    detector.reset();

    expect(detector.getState()).toBe("listening");
  });

  // The failure this backstop exists for, reproduced exactly: on the affected
  // device the RMS never crossed the start threshold, so the detector sat in
  // "listening" while transcription deltas piled up for 17-25s and not a
  // single utterance was ever finalized — no translation, every time.
  describe("maxUtteranceMs backstop", () => {
    test("finalizes on the cap even when the volume never registers as speech", () => {
      const onFinalize = vi.fn();
      const detector = new SilenceDetector({
        startThreshold: START_THRESHOLD,
        stopThreshold: STOP_THRESHOLD,
        silenceDurationMs: SILENCE_DURATION_MS,
        maxUtteranceMs: 5000,
        onFinalize,
      });

      // Every sample below the start threshold — speech is never detected.
      detector.update(0.001, 0);
      detector.update(0.001, 2000);
      expect(onFinalize).not.toHaveBeenCalled();
      expect(detector.getState()).toBe("listening");

      detector.update(0.001, 5000);

      expect(onFinalize).toHaveBeenCalledOnce();
    });

    test("restarts the cap after each finalize so it keeps firing", () => {
      const onFinalize = vi.fn();
      const detector = new SilenceDetector({
        startThreshold: START_THRESHOLD,
        stopThreshold: STOP_THRESHOLD,
        silenceDurationMs: SILENCE_DURATION_MS,
        maxUtteranceMs: 5000,
        onFinalize,
      });

      detector.update(0.001, 0);
      detector.update(0.001, 5000);
      expect(onFinalize).toHaveBeenCalledTimes(1);

      detector.update(0.001, 5050); // clock restarts here
      detector.update(0.001, 10050);

      expect(onFinalize).toHaveBeenCalledTimes(2);
    });

    // Threshold detection remains the preferred boundary — the cap must not
    // pre-empt a real pause that arrives first.
    test("normal silence detection still wins when it fires before the cap", () => {
      const onFinalize = vi.fn();
      const detector = new SilenceDetector({
        startThreshold: START_THRESHOLD,
        stopThreshold: STOP_THRESHOLD,
        silenceDurationMs: SILENCE_DURATION_MS,
        maxUtteranceMs: 5000,
        onFinalize,
      });

      detector.update(0.1, 0); // speaking
      detector.update(0.001, 100); // silence starts
      detector.update(0.001, 100 + SILENCE_DURATION_MS); // 1000ms — well under the cap

      expect(onFinalize).toHaveBeenCalledOnce();
    });

    test("no cap behaves exactly as before when maxUtteranceMs is omitted", () => {
      const onFinalize = vi.fn();
      const detector = createDetector({ onFinalize });

      detector.update(0.001, 0);
      detector.update(0.001, 60_000);

      expect(onFinalize).not.toHaveBeenCalled();
    });
  });

  // The ambient-noise calibration runs while the detector is already live
  // (it needs the running analyser to sample the room), so the thresholds it
  // computes have to be applied to an existing instance.
  describe("setThresholds", () => {
    test("a level that was too quiet to register now starts speech", () => {
      const onSpeechStart = vi.fn();
      const detector = createDetector({ onSpeechStart });

      detector.update(0.01, 0); // below the original 0.05 start threshold
      expect(onSpeechStart).not.toHaveBeenCalled();

      detector.setThresholds(0.005, 0.0025);
      detector.update(0.01, 50);

      expect(onSpeechStart).toHaveBeenCalledOnce();
      expect(detector.getState()).toBe("speaking");
    });

    test("the new stop threshold governs finalization", () => {
      const onFinalize = vi.fn();
      const detector = createDetector({ onFinalize });
      detector.setThresholds(0.005, 0.0025);

      detector.update(0.01, 0); // speaking
      detector.update(0.003, 100); // above the new stop threshold — still speaking
      expect(detector.getState()).toBe("speaking");

      detector.update(0.001, 200); // below it — silence starts
      expect(detector.getState()).toBe("silence_pending");

      detector.update(0.001, 200 + SILENCE_DURATION_MS);
      expect(onFinalize).toHaveBeenCalledOnce();
    });
  });
});
