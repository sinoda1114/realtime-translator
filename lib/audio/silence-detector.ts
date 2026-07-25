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

  constructor(private readonly options: SilenceDetectorOptions) {}

  getState(): SilenceDetectorState {
    return this.state;
  }

  update(rms: number, nowMs: number): void {
    if (this.state === "listening") {
      if (rms >= this.options.startThreshold) {
        this.state = "speaking";
        this.options.onSpeechStart?.();
      }
      return;
    }

    if (this.state === "speaking") {
      if (rms < this.options.stopThreshold) {
        this.state = "silence_pending";
        this.silenceSinceMs = nowMs;
      }
      return;
    }

    // silence_pending
    if (rms >= this.options.stopThreshold) {
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
