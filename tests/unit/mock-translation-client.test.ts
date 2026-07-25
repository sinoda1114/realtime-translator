import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MockTranslationClient } from "@/lib/translation/mock-translation-client";
import type { RealtimeConnectionState, TranslationClientError } from "@/types/translation";

function createStream(): MediaStream {
  return {} as MediaStream;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("MockTranslationClient", () => {
  test("transitions through connecting to connected on connect", async () => {
    const states: RealtimeConnectionState[] = [];
    const client = new MockTranslationClient({
      onSourceDelta: () => {},
      onTranslationDelta: () => {},
      onStateChange: (state) => states.push(state),
      onError: () => {},
    });

    const connectPromise = client.connect({
      clientSecret: "mock",
      stream: createStream(),
      targetLanguage: "en",
    });

    expect(states).toEqual(["connecting"]);

    await vi.advanceTimersByTimeAsync(400);
    await connectPromise;

    expect(states).toEqual(["connecting", "connected"]);

    await client.close();
  });

  test("streams source and translation deltas without inserting whitespace", async () => {
    let sourceText = "";
    let translatedText = "";
    const client = new MockTranslationClient({
      onSourceDelta: (delta) => {
        sourceText += delta;
      },
      onTranslationDelta: (delta) => {
        translatedText += delta;
      },
      onStateChange: () => {},
      onError: () => {},
    });

    const connectPromise = client.connect({
      clientSecret: "mock",
      stream: createStream(),
      targetLanguage: "en",
    });
    await vi.advanceTimersByTimeAsync(400);
    await connectPromise;

    // Drain the first utterance's deltas (3 source + 3 translated deltas at 250ms each).
    await vi.advanceTimersByTimeAsync(250 * 6);

    expect(sourceText).toBe("今日は横浜に行きます。");
    expect(translatedText).toBe("I'm going to Yokohama today.");

    await client.close();
  });

  test("close stops further delta emission", async () => {
    let deltaCount = 0;
    const client = new MockTranslationClient({
      onSourceDelta: () => {
        deltaCount += 1;
      },
      onTranslationDelta: () => {},
      onStateChange: () => {},
      onError: () => {},
    });

    const connectPromise = client.connect({
      clientSecret: "mock",
      stream: createStream(),
      targetLanguage: "en",
    });
    await vi.advanceTimersByTimeAsync(400);
    await connectPromise;

    await client.close();
    const countAfterClose = deltaCount;

    await vi.advanceTimersByTimeAsync(10_000);

    expect(deltaCount).toBe(countAfterClose);
  });

  test("injectError forwards the error to the callback", () => {
    const errors: TranslationClientError[] = [];
    const client = new MockTranslationClient({
      onSourceDelta: () => {},
      onTranslationDelta: () => {},
      onStateChange: () => {},
      onError: (error) => errors.push(error),
    });

    client.injectError({ code: "REALTIME_API_ERROR", message: "test error" });

    expect(errors).toEqual([{ code: "REALTIME_API_ERROR", message: "test error" }]);
  });
});
