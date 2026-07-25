import type {
  TargetLanguage,
  TranslationClient,
  TranslationClientCallbacks,
  TranslationClientConnectInput,
  TranslationClientError,
} from "@/types/translation";

interface MockUtteranceScript {
  sourceDeltas: string[];
  translatedDeltas: string[];
}

const CONNECT_DELAY_MS = 400;
const DELTA_INTERVAL_MS = 250;
const UTTERANCE_GAP_MS = 1400;

const SCRIPTS_BY_TARGET: Record<TargetLanguage, MockUtteranceScript[]> = {
  en: [
    {
      sourceDeltas: ["今日は", "横浜に", "行きます。"],
      translatedDeltas: ["I'm going", " to Yokohama", " today."],
    },
    {
      sourceDeltas: ["よろしく", "お願いします。"],
      translatedDeltas: ["Nice to", " meet you."],
    },
  ],
  ja: [
    {
      sourceDeltas: ["I'm going", " to the station", " now."],
      translatedDeltas: ["私は", "今から", "駅に向かいます。"],
    },
    {
      sourceDeltas: ["Nice to", " meet you."],
      translatedDeltas: ["よろしく", "お願いします。"],
    },
  ],
};

export class MockTranslationClient implements TranslationClient {
  private callbacks: TranslationClientCallbacks | null = null;
  private targetLanguage: TargetLanguage = "en";
  private timers: ReturnType<typeof setTimeout>[] = [];
  private scriptIndex = 0;
  private closed = false;

  constructor(callbacks: TranslationClientCallbacks) {
    this.callbacks = callbacks;
  }

  async connect(input: TranslationClientConnectInput): Promise<void> {
    this.closed = false;
    this.targetLanguage = input.targetLanguage;
    this.callbacks?.onStateChange("connecting");

    await new Promise((resolve) => {
      const timer = setTimeout(resolve, CONNECT_DELAY_MS);
      this.timers.push(timer);
    });

    if (this.closed) {
      return;
    }

    this.callbacks?.onStateChange("connected");
    this.scheduleNextUtterance(0);
  }

  updateTargetLanguage(language: TargetLanguage): void {
    this.targetLanguage = language;
    this.scriptIndex = 0;
  }

  injectError(error: TranslationClientError): void {
    this.callbacks?.onError(error);
  }

  async close(): Promise<void> {
    this.closed = true;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.callbacks?.onStateChange("disconnected");
  }

  private scheduleNextUtterance(delayMs: number): void {
    const timer = setTimeout(() => {
      if (this.closed) {
        return;
      }
      void this.playUtterance();
    }, delayMs);
    this.timers.push(timer);
  }

  private async playUtterance(): Promise<void> {
    const scripts = SCRIPTS_BY_TARGET[this.targetLanguage];
    const script = scripts[this.scriptIndex % scripts.length];
    this.scriptIndex += 1;

    for (const delta of script.sourceDeltas) {
      if (this.closed) {
        return;
      }
      this.callbacks?.onSourceDelta(delta);
      await this.wait(DELTA_INTERVAL_MS);
    }

    for (const delta of script.translatedDeltas) {
      if (this.closed) {
        return;
      }
      this.callbacks?.onTranslationDelta(delta);
      await this.wait(DELTA_INTERVAL_MS);
    }

    if (this.closed) {
      return;
    }

    this.scheduleNextUtterance(UTTERANCE_GAP_MS);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      this.timers.push(timer);
    });
  }
}
