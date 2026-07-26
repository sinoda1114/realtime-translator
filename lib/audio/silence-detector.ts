export type SilenceDetectorState = "listening" | "speaking" | "silence_pending";

export interface SilenceDetectorOptions {
  startThreshold: number;
  stopThreshold: number;
  silenceDurationMs: number;
  /**
   * Hard ceiling on how long audio may accumulate before being finalized,
   * regardless of RMS.
   *
   * Exists because threshold-based detection cannot be made reliable across
   * devices from this side of the microphone. On the affected phone the
   * ambient noise floor and speech level are close enough together that
   * every threshold tried — fixed, and twice-calibrated — either never
   * registered speech or never registered the pause after it. The observable
   * result was 38-78 transcription deltas piling up over 17-25 seconds with
   * zero utterances finalized and therefore zero translations, every time.
   *
   * This cap makes progress independent of that tuning: worst case an
   * utterance is split at an arbitrary point, which is plainly better than
   * never producing a translation at all. Threshold detection still runs and
   * still produces better boundaries whenever it works.
   */
  maxUtteranceMs?: number;
  onSpeechStart?: () => void;
  onFinalize?: () => void;
}

export class SilenceDetector {
  private state: SilenceDetectorState = "listening";
  private silenceSinceMs: number | null = null;
  private startThreshold: number;
  private stopThreshold: number;
  /** When the currently-accumulating audio began, for the max-duration cap. */
  private accumulatingSinceMs: number | null = null;

  constructor(private readonly options: SilenceDetectorOptions) {
    this.startThreshold = options.startThreshold;
    this.stopThreshold = options.stopThreshold;
  }

  getState(): SilenceDetectorState {
    return this.state;
  }

  /**
   * Replaces the thresholds mid-session. Used once, right after the ambient
   * noise calibration window closes — the detector has to exist and be
   * running to collect those samples, so the final thresholds aren't known
   * at construction time.
   */
  setThresholds(startThreshold: number, stopThreshold: number): void {
    this.startThreshold = startThreshold;
    this.stopThreshold = stopThreshold;
  }

  update(rms: number, nowMs: number): void {
    // The clock starts on the first sample of the session, not on detected
    // speech — the whole point of the cap is to work when speech is never
    // detected, so it cannot depend on the speech detection it backstops.
    this.accumulatingSinceMs ??= nowMs;

    const { maxUtteranceMs } = this.options;
    if (maxUtteranceMs !== undefined && nowMs - this.accumulatingSinceMs >= maxUtteranceMs) {
      this.finalize();
      return;
    }

    if (this.state === "listening") {
      if (rms >= this.startThreshold) {
        this.state = "speaking";
        this.options.onSpeechStart?.();
      }
      return;
    }

    if (this.state === "speaking") {
      if (rms < this.stopThreshold) {
        this.state = "silence_pending";
        this.silenceSinceMs = nowMs;
      }
      return;
    }

    // silence_pending
    if (rms >= this.stopThreshold) {
      this.state = "speaking";
      this.silenceSinceMs = null;
      return;
    }

    if (this.silenceSinceMs !== null && nowMs - this.silenceSinceMs >= this.options.silenceDurationMs) {
      this.finalize();
    }
  }

  /**
   * Forces a finalize regardless of state. Deliberately not gated on
   * "speaking" any more: when threshold detection never fires, the state
   * stays "listening" for the whole session even though audio has been
   * accumulating the entire time — and stop()/language-switch would then
   * silently discard it.
   */
  flush(): void {
    this.finalize();
  }

  reset(): void {
    this.state = "listening";
    this.silenceSinceMs = null;
    this.accumulatingSinceMs = null;
  }

  private finalize(): void {
    this.state = "listening";
    this.silenceSinceMs = null;
    // Restarts the cap's clock, so the next window is measured from here
    // rather than from the start of the session.
    this.accumulatingSinceMs = null;
    this.options.onFinalize?.();
  }
}
