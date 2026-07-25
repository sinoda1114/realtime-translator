export type SilenceDetectorState = "listening" | "speaking" | "silence_pending";

export interface SilenceDetectorOptions {
  startThreshold: number;
  stopThreshold: number;
  silenceDurationMs: number;
  onSpeechStart?: () => void;
  onFinalize?: () => void;
}

export class SilenceDetector {
  private state: SilenceDetectorState = "listening";
  private silenceSinceMs: number | null = null;
  private startThreshold: number;
  private stopThreshold: number;

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

  flush(): void {
    if (this.state === "speaking" || this.state === "silence_pending") {
      this.finalize();
    }
  }

  reset(): void {
    this.state = "listening";
    this.silenceSinceMs = null;
  }

  private finalize(): void {
    this.state = "listening";
    this.silenceSinceMs = null;
    this.options.onFinalize?.();
  }
}
