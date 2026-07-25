import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { RealtimeTranscriptionClient } from "@/lib/openai/transcription-client";
import type { TranslationClientCallbacks } from "@/types/translation";

function createCallbacks() {
  const callbacks: TranslationClientCallbacks = {
    onSourceDelta: vi.fn(),
    onTranslationDelta: vi.fn(),
    onStateChange: vi.fn(),
    onError: vi.fn(),
  };
  return callbacks as {
    [K in keyof TranslationClientCallbacks]: TranslationClientCallbacks[K] & ReturnType<typeof vi.fn>;
  };
}

// commitUtterance requires an open DataChannel; connect() needs real WebRTC,
// which isn't available in this test environment, so tests that exercise
// commitUtterance inject a minimal fake channel directly onto the private
// field instead.
function attachOpenDataChannel(client: RealtimeTranscriptionClient): {
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
} {
  // close() is part of the fake because close()/teardownConnection() call it;
  // tests that exercise the stop path would otherwise fail on a missing method.
  const fakeChannel = { readyState: "open" as const, send: vi.fn(), close: vi.fn() };
  (client as unknown as { dataChannel: typeof fakeChannel }).dataChannel = fakeChannel;
  return fakeChannel;
}

describe("RealtimeTranscriptionClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("forwards transcript deltas to onSourceDelta", () => {
    const callbacks = createCallbacks();
    const client = new RealtimeTranscriptionClient(callbacks);

    client.handleServerEvent(
      JSON.stringify({
        type: "conversation.item.input_audio_transcription.delta",
        item_id: "item-1",
        delta: "Hello",
      }),
    );

    expect(callbacks.onSourceDelta).toHaveBeenCalledWith("Hello");
  });

  test("commitUtterance resolves with the completed transcript for that item", async () => {
    const callbacks = createCallbacks();
    const client = new RealtimeTranscriptionClient(callbacks);
    attachOpenDataChannel(client);
    client.handleServerEvent(
      JSON.stringify({
        type: "conversation.item.input_audio_transcription.delta",
        item_id: "item-1",
        delta: "Hi",
      }),
    );

    const commitPromise = client.commitUtterance!();
    client.handleServerEvent(
      JSON.stringify({ type: "input_audio_buffer.committed", item_id: "item-1" }),
    );
    client.handleServerEvent(
      JSON.stringify({
        type: "conversation.item.input_audio_transcription.completed",
        item_id: "item-1",
        transcript: "Hi there",
      }),
    );

    await expect(commitPromise).resolves.toEqual({ transcript: "Hi there", source: "completed" });
  });

  test("commitUtterance falls back to accumulated text on timeout", async () => {
    const callbacks = createCallbacks();
    const client = new RealtimeTranscriptionClient(callbacks, { commitTimeoutMs: 2000 });
    attachOpenDataChannel(client);
    client.handleServerEvent(
      JSON.stringify({
        type: "conversation.item.input_audio_transcription.delta",
        item_id: "item-1",
        delta: "partial",
      }),
    );

    const commitPromise = client.commitUtterance!();
    vi.advanceTimersByTime(2000);

    await expect(commitPromise).resolves.toEqual({ transcript: "partial", source: "fallback" });
  });

  test("commitUtterance rejects without an open DataChannel instead of silently resolving", async () => {
    const callbacks = createCallbacks();
    const client = new RealtimeTranscriptionClient(callbacks);
    // No attachOpenDataChannel() call — dataChannel stays null (never connected).

    await expect(client.commitUtterance!()).rejects.toThrow();
  });

  test("commitUtterance sends the commit event over the DataChannel", async () => {
    const callbacks = createCallbacks();
    const client = new RealtimeTranscriptionClient(callbacks, { commitTimeoutMs: 1000 });
    const channel = attachOpenDataChannel(client);

    const commitPromise = client.commitUtterance!();
    vi.advanceTimersByTime(1000);
    await commitPromise;

    expect(channel.send).toHaveBeenCalledWith(JSON.stringify({ type: "input_audio_buffer.commit" }));
  });

  // Regression: on stop(), flush() finalizes the last utterance microseconds
  // before teardown() closes the channel, so send() throws InvalidStateError.
  // Previously that throw escaped commitUtterance() synchronously — before
  // tracker.commit() ran — so no pending entry existed and the accumulated
  // transcript was discarded outright. Registering the pending commit first
  // means close()'s flushAll() can still salvage it.
  test("salvages the accumulated transcript when send() throws mid-close", async () => {
    const callbacks = createCallbacks();
    const client = new RealtimeTranscriptionClient(callbacks);
    const channel = attachOpenDataChannel(client);
    client.handleServerEvent(
      JSON.stringify({
        type: "conversation.item.input_audio_transcription.delta",
        item_id: "item-1",
        delta: "最後の発話",
      }),
    );
    channel.send.mockImplementation(() => {
      throw new Error("InvalidStateError: readyState not 'open'");
    });

    const commitPromise = client.commitUtterance!();
    await client.close(); // flushAll() resolves the pending from accumulated deltas

    await expect(commitPromise).resolves.toEqual({
      transcript: "最後の発話",
      source: "fallback",
    });
  });

  test("a failed send still resolves via the timeout when close() never runs", async () => {
    const callbacks = createCallbacks();
    const client = new RealtimeTranscriptionClient(callbacks, { commitTimeoutMs: 2000 });
    const channel = attachOpenDataChannel(client);
    client.handleServerEvent(
      JSON.stringify({
        type: "conversation.item.input_audio_transcription.delta",
        item_id: "item-1",
        delta: "途中まで",
      }),
    );
    channel.send.mockImplementation(() => {
      throw new Error("InvalidStateError: readyState not 'open'");
    });

    const commitPromise = client.commitUtterance!();
    vi.advanceTimersByTime(2000);

    await expect(commitPromise).resolves.toEqual({
      transcript: "途中まで",
      source: "fallback",
    });
  });

  test("treats an empty-buffer commit error as non-fatal (no onError call)", () => {
    const callbacks = createCallbacks();
    const client = new RealtimeTranscriptionClient(callbacks);

    client.handleServerEvent(
      JSON.stringify({ type: "error", error: { message: "input buffer is too small" } }),
    );

    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  test("treats other errors as fatal (onError called)", () => {
    const callbacks = createCallbacks();
    const client = new RealtimeTranscriptionClient(callbacks);

    client.handleServerEvent(
      JSON.stringify({ type: "error", error: { message: "internal server error" } }),
    );

    expect(callbacks.onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "REALTIME_API_ERROR" }),
    );
  });

  test("ignores malformed JSON without throwing", () => {
    const callbacks = createCallbacks();
    const client = new RealtimeTranscriptionClient(callbacks);

    expect(() => client.handleServerEvent("not json")).not.toThrow();
    expect(callbacks.onSourceDelta).not.toHaveBeenCalled();
  });

  test("warns once per unhandled event type without calling onError", () => {
    const callbacks = createCallbacks();
    const client = new RealtimeTranscriptionClient(callbacks);

    client.handleServerEvent(JSON.stringify({ type: "session.created" }));
    client.handleServerEvent(JSON.stringify({ type: "session.created" }));

    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  describe("reconnection", () => {
    // The real WebRTC connection setup (openConnection) isn't available in
    // this test environment (see the file-level comment above), so these
    // tests drive the private reconnect state machine directly and stub
    // openConnection where a reconnect attempt needs to "succeed".
    function asInternal(client: RealtimeTranscriptionClient) {
      const internal = client as unknown as {
        refreshClientSecret: ((targetLanguage: "ja" | "en") => Promise<string>) | null;
        targetLanguage: "ja" | "en" | null;
        isClosing: boolean;
        reconnectTimer: ReturnType<typeof setTimeout> | null;
        reconnectAttempt: number;
        openConnection: (clientSecret: string) => Promise<void>;
        scheduleReconnect: () => void;
      };
      // attemptReconnect() requires a known targetLanguage (set by connect(),
      // which these tests bypass) before it will call refreshClientSecret.
      internal.targetLanguage = "en";
      return internal;
    }

    test("gives up immediately when no refreshClientSecret was provided", () => {
      const callbacks = createCallbacks();
      const client = new RealtimeTranscriptionClient(callbacks);
      const internal = asInternal(client);
      internal.refreshClientSecret = null;

      internal.scheduleReconnect();

      expect(callbacks.onStateChange).toHaveBeenCalledWith("disconnected");
      expect(internal.reconnectTimer).toBeNull();
    });

    test("does nothing once the client is closing", () => {
      const callbacks = createCallbacks();
      const client = new RealtimeTranscriptionClient(callbacks);
      const internal = asInternal(client);
      internal.refreshClientSecret = vi.fn().mockResolvedValue("fresh-secret");
      internal.isClosing = true;

      internal.scheduleReconnect();

      expect(callbacks.onStateChange).not.toHaveBeenCalled();
      expect(internal.reconnectTimer).toBeNull();
    });

    test("debounces duplicate reconnect triggers for the same drop", () => {
      const callbacks = createCallbacks();
      const client = new RealtimeTranscriptionClient(callbacks);
      const internal = asInternal(client);
      internal.refreshClientSecret = vi.fn().mockResolvedValue("fresh-secret");

      internal.scheduleReconnect();
      internal.scheduleReconnect();

      expect(callbacks.onStateChange).toHaveBeenCalledWith("reconnecting");
      expect(callbacks.onStateChange).toHaveBeenCalledTimes(1);
    });

    test("reconnects with a fresh secret and reports connected on success", async () => {
      const callbacks = createCallbacks();
      const client = new RealtimeTranscriptionClient(callbacks);
      const internal = asInternal(client);
      internal.refreshClientSecret = vi.fn().mockResolvedValue("fresh-secret");
      internal.openConnection = vi.fn().mockResolvedValue(undefined);

      internal.scheduleReconnect();
      expect(callbacks.onStateChange).toHaveBeenCalledWith("reconnecting");

      await vi.advanceTimersByTimeAsync(1_000);

      expect(internal.refreshClientSecret).toHaveBeenCalledTimes(1);
      expect(internal.openConnection).toHaveBeenCalledWith("fresh-secret");
      expect(callbacks.onStateChange).toHaveBeenCalledWith("connected");
      expect(internal.reconnectAttempt).toBe(0);
    });

    test("gives up and reports disconnected after exhausting all reconnect attempts", async () => {
      const callbacks = createCallbacks();
      const client = new RealtimeTranscriptionClient(callbacks);
      const internal = asInternal(client);
      internal.refreshClientSecret = vi.fn().mockRejectedValue(new Error("token endpoint down"));

      internal.scheduleReconnect();
      await vi.advanceTimersByTimeAsync(1_000); // attempt 1 fails
      await vi.advanceTimersByTimeAsync(2_000); // attempt 2 fails
      await vi.advanceTimersByTimeAsync(4_000); // attempt 3 fails, exhausted

      expect(internal.refreshClientSecret).toHaveBeenCalledTimes(3);
      expect(callbacks.onStateChange).toHaveBeenLastCalledWith("disconnected");
    });

    // Regression: close() can land while a reconnect attempt is mid-flight
    // (awaiting a fresh token, or the SDP exchange itself). Without the
    // isClosing re-checks inside attemptReconnect(), a reconnect completing
    // after the user pressed stop would silently revive the session and
    // report "connected" out from under the already-torn-down UI state.
    test("does not report connected if close() runs while the SDP exchange is still in flight", async () => {
      const callbacks = createCallbacks();
      const client = new RealtimeTranscriptionClient(callbacks);
      const internal = asInternal(client);
      internal.refreshClientSecret = vi.fn().mockResolvedValue("fresh-secret");

      let resolveOpen: () => void = () => {};
      internal.openConnection = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveOpen = resolve;
          }),
      );

      internal.scheduleReconnect();
      await vi.advanceTimersByTimeAsync(1_000); // fires attemptReconnect(); it's now awaiting openConnection()

      internal.isClosing = true; // simulate the user pressing stop mid-reconnect
      resolveOpen();
      await Promise.resolve();
      await Promise.resolve();

      expect(callbacks.onStateChange).not.toHaveBeenCalledWith("connected");
    });

    // Regression: refreshClientSecret() is also an await boundary close()
    // can land during — a reconnect must not spend a round-trip opening a
    // connection for a session that's already being torn down.
    test("does not call openConnection if close() runs while awaiting a fresh client secret", async () => {
      const callbacks = createCallbacks();
      const client = new RealtimeTranscriptionClient(callbacks);
      const internal = asInternal(client);

      let resolveSecret: (secret: string) => void = () => {};
      internal.refreshClientSecret = vi.fn(
        () =>
          new Promise<string>((resolve) => {
            resolveSecret = resolve;
          }),
      );
      internal.openConnection = vi.fn().mockResolvedValue(undefined);

      internal.scheduleReconnect();
      await vi.advanceTimersByTimeAsync(1_000); // fires attemptReconnect(); it's now awaiting refreshClientSecret

      internal.isClosing = true;
      resolveSecret("fresh-secret");
      await Promise.resolve();
      await Promise.resolve();

      expect(internal.openConnection).not.toHaveBeenCalled();
      expect(callbacks.onStateChange).not.toHaveBeenCalledWith("connected");
    });
  });
});
