import { describe, expect, test, vi } from "vitest";
import { RealtimeTranslationClient } from "@/lib/openai/realtime-client";
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

// The real WebRTC connection setup (openConnection) isn't available in this
// test environment, so these tests drive the private language-switch
// reconnect flow directly and stub openConnection where an attempt needs to
// "succeed". See the identical pattern (and its rationale) in
// transcription-client.test.ts.
function asInternal(client: RealtimeTranslationClient) {
  return client as unknown as {
    refreshClientSecret: ((targetLanguage: "ja" | "en") => Promise<string>) | null;
    isClosing: boolean;
    switchSeq: number;
    connectionGeneration: number;
    dataChannel: { close: () => void } | null;
    peerConnection: { close: () => void } | null;
    openConnection: (clientSecret: string) => Promise<void>;
    reconnectForLanguageSwitch: (language: "ja" | "en") => Promise<void>;
  };
}

describe("RealtimeTranslationClient", () => {
  describe("updateTargetLanguage (reconnect-on-switch)", () => {
    // v1's translation endpoint has no documented way to hint the source
    // language mid-stream; switching direction now reconnects with a fresh
    // session for the new target language instead of a bare session.update
    // (see the comment on updateTargetLanguage for the real-device symptom
    // that motivated this).
    test("reconnects with a fresh secret for the requested language and reports connected", async () => {
      const callbacks = createCallbacks();
      const client = new RealtimeTranslationClient(callbacks);
      const internal = asInternal(client);
      internal.refreshClientSecret = vi.fn().mockResolvedValue("fresh-secret");
      internal.openConnection = vi.fn().mockResolvedValue(undefined);

      await internal.reconnectForLanguageSwitch("en");

      expect(internal.refreshClientSecret).toHaveBeenCalledWith("en");
      expect(internal.openConnection).toHaveBeenCalledWith("fresh-secret");
      expect(callbacks.onStateChange).toHaveBeenCalledWith("reconnecting");
      expect(callbacks.onStateChange).toHaveBeenCalledWith("connected");
    });

    test("does nothing when no refreshClientSecret was configured", async () => {
      const callbacks = createCallbacks();
      const client = new RealtimeTranslationClient(callbacks);
      const internal = asInternal(client);
      internal.refreshClientSecret = null;

      await internal.reconnectForLanguageSwitch("en");

      expect(callbacks.onStateChange).not.toHaveBeenCalled();
    });

    test("does nothing once the client is closing", async () => {
      const callbacks = createCallbacks();
      const client = new RealtimeTranslationClient(callbacks);
      const internal = asInternal(client);
      internal.refreshClientSecret = vi.fn().mockResolvedValue("fresh-secret");
      internal.isClosing = true;

      await internal.reconnectForLanguageSwitch("en");

      expect(callbacks.onStateChange).not.toHaveBeenCalled();
    });

    test("reports an error if the reconnect fails", async () => {
      const callbacks = createCallbacks();
      const client = new RealtimeTranslationClient(callbacks);
      const internal = asInternal(client);
      internal.refreshClientSecret = vi.fn().mockResolvedValue("fresh-secret");
      internal.openConnection = vi.fn().mockRejectedValue(new Error("SDP exchange failed"));

      await internal.reconnectForLanguageSwitch("en");

      expect(callbacks.onError).toHaveBeenCalledWith(
        expect.objectContaining({ code: "REALTIME_API_ERROR" }),
      );
      expect(callbacks.onStateChange).toHaveBeenCalledWith("error");
    });

    // Regression: if the user flips the language button twice in quick
    // succession, only the most recently requested switch should be allowed
    // to land as "connected" — an earlier switch resolving after being
    // superseded must not overwrite the newer one's session.
    test("ignores a stale switch superseded by a newer one", async () => {
      const callbacks = createCallbacks();
      const client = new RealtimeTranslationClient(callbacks);
      const internal = asInternal(client);

      let resolveFirstSecret: (secret: string) => void = () => {};
      internal.refreshClientSecret = vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<string>((resolve) => {
              resolveFirstSecret = resolve;
            }),
        )
        .mockResolvedValueOnce("second-secret");
      internal.openConnection = vi.fn().mockResolvedValue(undefined);

      const firstSwitch = internal.reconnectForLanguageSwitch("en"); // stalls awaiting its secret
      await internal.reconnectForLanguageSwitch("ja"); // completes fully first

      callbacks.onStateChange.mockClear();
      resolveFirstSecret("first-secret"); // now let the stale switch resume
      await firstSwitch;

      expect(callbacks.onStateChange).not.toHaveBeenCalledWith("connected");
    });

    // Regression: close() can land while a switch is mid-flight (awaiting a
    // fresh token or the SDP exchange). A switch completing after that must
    // not revive/report a connection the caller already asked to stop.
    test("does not report connected if close() runs while the switch is in flight", async () => {
      const callbacks = createCallbacks();
      const client = new RealtimeTranslationClient(callbacks);
      const internal = asInternal(client);
      internal.refreshClientSecret = vi.fn().mockResolvedValue("fresh-secret");

      let resolveOpen: () => void = () => {};
      internal.openConnection = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveOpen = resolve;
          }),
      );

      const switchPromise = internal.reconnectForLanguageSwitch("en");
      await Promise.resolve();
      await Promise.resolve();

      internal.isClosing = true;
      resolveOpen();
      await switchPromise;

      expect(callbacks.onStateChange).not.toHaveBeenCalledWith("connected");
    });

    // Regression: a stale switch's post-openConnection cleanup used to call
    // an unconditional teardown, which would close whatever connection was
    // CURRENTLY live — including a newer switch's already-established,
    // reported-as-connected session. The stub below mimics openConnection's
    // real generation bump and connection-object assignment so the
    // generation-guarded teardown can be observed directly.
    test("a stale switch's cleanup does not close a newer, already-connected session", async () => {
      const callbacks = createCallbacks();
      const client = new RealtimeTranslationClient(callbacks);
      const internal = asInternal(client);
      internal.refreshClientSecret = vi.fn().mockResolvedValue("secret");

      let resolveStaleOpen: () => void = () => {};
      let attempt = 0;
      const dataChannelCloseByAttempt: Record<number, ReturnType<typeof vi.fn>> = {};
      internal.openConnection = vi.fn().mockImplementation(() => {
        attempt += 1;
        const myAttempt = attempt;
        internal.connectionGeneration += 1;
        const closeSpy = vi.fn();
        dataChannelCloseByAttempt[myAttempt] = closeSpy;
        internal.dataChannel = { close: closeSpy };
        internal.peerConnection = { close: vi.fn() };
        if (myAttempt === 1) {
          return new Promise<void>((resolve) => {
            resolveStaleOpen = resolve;
          });
        }
        return Promise.resolve();
      });

      const staleSwitch = internal.reconnectForLanguageSwitch("en"); // attempt #1, stalls mid-connect
      await Promise.resolve();
      await Promise.resolve();
      await internal.reconnectForLanguageSwitch("ja"); // attempt #2, completes fully and reports connected

      resolveStaleOpen(); // let attempt #1 resume and run its now-stale cleanup
      await staleSwitch;

      expect(dataChannelCloseByAttempt[2]).not.toHaveBeenCalled();
    });

    // Regression: openConnection() can partially set up a connection before
    // failing (e.g. the SDP fetch itself rejects) — the switch's catch
    // block must clean that up instead of leaving it dangling.
    test("cleans up a partially-created connection when the switch fails", async () => {
      const callbacks = createCallbacks();
      const client = new RealtimeTranslationClient(callbacks);
      const internal = asInternal(client);
      internal.refreshClientSecret = vi.fn().mockResolvedValue("secret");

      const dataChannelClose = vi.fn();
      internal.openConnection = vi.fn().mockImplementation(() => {
        internal.connectionGeneration += 1;
        internal.dataChannel = { close: dataChannelClose };
        internal.peerConnection = { close: vi.fn() };
        return Promise.reject(new Error("SDP exchange failed"));
      });

      await internal.reconnectForLanguageSwitch("en");

      expect(dataChannelClose).toHaveBeenCalled();
      expect(callbacks.onStateChange).toHaveBeenCalledWith("error");
    });
  });

  describe("close()", () => {
    // Regression: close() must invalidate any language switch still
    // awaiting a token/SDP exchange, so it can never complete against a
    // session established by a later connect() call on the same instance
    // (isClosing alone doesn't cover this — connect() resets it to false).
    test("invalidates an in-flight switch so it cannot land after a later connect()", async () => {
      const callbacks = createCallbacks();
      const client = new RealtimeTranslationClient(callbacks);
      const internal = asInternal(client);

      let resolveSecret: (secret: string) => void = () => {};
      internal.refreshClientSecret = vi.fn(
        () =>
          new Promise<string>((resolve) => {
            resolveSecret = resolve;
          }),
      );
      internal.openConnection = vi.fn().mockResolvedValue(undefined);

      const staleSwitch = internal.reconnectForLanguageSwitch("en");
      await Promise.resolve();

      await client.close();
      internal.isClosing = false; // simulate a later connect() on the same instance resetting this

      callbacks.onStateChange.mockClear();
      resolveSecret("late-secret");
      await staleSwitch;

      expect(callbacks.onStateChange).not.toHaveBeenCalledWith("connected");
      expect(internal.openConnection).not.toHaveBeenCalled();
    });
  });
});
