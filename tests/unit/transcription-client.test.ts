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
function attachOpenDataChannel(client: RealtimeTranscriptionClient): { send: ReturnType<typeof vi.fn> } {
  const fakeChannel = { readyState: "open" as const, send: vi.fn() };
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
});
