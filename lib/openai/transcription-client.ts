import type {
  TargetLanguage,
  TranscriptionCommitResult,
  TranslationClient,
  TranslationClientCallbacks,
  TranslationClientConnectInput,
} from "@/types/translation";
import type { TranscriptionServerEvent } from "./realtime-types";
import { TranscriptionCommitTracker } from "./commit-tracker";
import { logger } from "@/lib/logger";

const SDP_ENDPOINT = "https://api.openai.com/v1/realtime/calls";
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_BACKOFF_MS = [1_000, 2_000, 4_000];

// Diagnostic helper for malformed-event warnings — deliberately reports only
// field presence/type and key names, never field values, since delta/
// transcript values are the user's actual transcribed speech.
function eventShapeFields(event: Record<string, unknown>): Record<string, string> {
  return {
    keys: Object.keys(event).sort().join(","),
    itemIdType: typeof event.item_id,
    deltaType: typeof event.delta,
    transcriptType: typeof event.transcript,
  };
}

export interface RealtimeTranscriptionClientOptions {
  commitTimeoutMs?: number;
}

// v2 translation engine's client: a transcription-only realtime session
// (gpt-realtime-whisper) instead of the translation endpoint. Source text
// still streams live via delta events, but instead of also receiving a
// translation stream, the caller commits the buffer on silence and awaits
// the authoritative transcript (paired via item_id, unlike the v1 endpoint)
// before requesting a server-side text translation for that exact text.
export class RealtimeTranscriptionClient implements TranslationClient {
  private readonly callbacks: TranslationClientCallbacks;
  private readonly tracker: TranscriptionCommitTracker;
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private readonly warnedUnhandledEventTypes = new Set<string>();
  private stream: MediaStream | null = null;
  private refreshClientSecret: (() => Promise<string>) | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isClosing = false;
  // Bumped by teardownConnection() and captured locally by each
  // openConnection() call. A pc/dataChannel's event handlers close over the
  // generation they were created under, so a close/statechange event firing
  // late — after that connection has already been torn down and replaced —
  // is recognized as stale (this.connectionGeneration has moved on) and
  // ignored instead of tearing down or reconnecting a since-established
  // healthy connection.
  private connectionGeneration = 0;

  constructor(callbacks: TranslationClientCallbacks, options: RealtimeTranscriptionClientOptions = {}) {
    this.callbacks = callbacks;
    this.tracker = new TranscriptionCommitTracker({ commitTimeoutMs: options.commitTimeoutMs });
  }

  async connect(input: TranslationClientConnectInput): Promise<void> {
    this.stream = input.stream;
    this.refreshClientSecret = input.refreshClientSecret ?? null;
    this.isClosing = false;
    this.reconnectAttempt = 0;

    try {
      await this.openConnection(input.clientSecret);
      this.callbacks.onStateChange("connected");
    } catch {
      this.teardownConnection();
      this.callbacks.onError({
        code: "REALTIME_API_ERROR",
        message: "翻訳中にエラーが発生しました",
      });
      this.callbacks.onStateChange("error");
    }
  }

  // Pure connection setup: creates the peer connection, wires the data
  // channel, and performs the SDP exchange. Throws on any failure — callers
  // decide how to react (a fatal error on the initial connect vs. a
  // retryable attempt during reconnect).
  private async openConnection(clientSecret: string): Promise<void> {
    const stream = this.stream;
    if (!stream) {
      throw new Error("Cannot connect: no media stream available");
    }

    this.callbacks.onStateChange("connecting");

    const generation = ++this.connectionGeneration;
    const pc = new RTCPeerConnection();
    this.peerConnection = pc;

    pc.ontrack = (event) => {
      event.streams.forEach((eventStream) => {
        eventStream.getTracks().forEach((track) => {
          track.enabled = false;
        });
      });
    };

    pc.onconnectionstatechange = () => {
      if (this.connectionGeneration !== generation) {
        return; // stale event from a connection already replaced/torn down
      }
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        this.scheduleReconnect();
      }
    };

    for (const track of stream.getAudioTracks()) {
      pc.addTrack(track, stream);
    }

    const dataChannel = pc.createDataChannel("oai-events");
    this.dataChannel = dataChannel;
    dataChannel.onmessage = (event: MessageEvent<string>) => this.handleServerEvent(event.data);
    // The data channel can close (SCTP association drop, mobile network
    // hiccup) without RTCPeerConnection.connectionState ever leaving
    // "connected" — this was the actual failure mode behind a real-device
    // "発話の確定に失敗しました" report: source audio kept streaming live
    // (delta events worked fine) but commitUtterance() found the channel no
    // longer open by the time silence detection fired. Treat this as an
    // equally valid reconnect trigger, not just connectionstatechange.
    //
    // Also relied on to prevent an initial connect() failure from turning
    // into a reconnect attempt: connect()'s catch calls teardownConnection()
    // directly (not scheduleReconnect()), and teardownConnection() bumps
    // connectionGeneration before closing anything, so the onclose this
    // triggers is already stale by the time it fires and this check no-ops.
    dataChannel.onclose = () => {
      if (this.connectionGeneration !== generation) {
        return;
      }
      this.scheduleReconnect();
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const response = await fetch(SDP_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clientSecret}`,
        "Content-Type": "application/sdp",
      },
      body: offer.sdp,
    });

    if (!response.ok) {
      logger.error("transcription.sdp_exchange_failed", { status: response.status });
      throw new Error(`SDP_EXCHANGE_FAILED_${response.status}`);
    }

    const answerSdp = await response.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
  }

  private teardownConnection(): void {
    // Bump first: the close() calls below can synchronously or
    // asynchronously fire the pc/dataChannel handlers installed by
    // openConnection() for this generation. Bumping before closing makes
    // those handlers recognize themselves as stale and no-op, instead of
    // reacting to a teardown we ourselves initiated.
    this.connectionGeneration += 1;
    this.dataChannel?.close();
    this.dataChannel = null;
    this.peerConnection?.close();
    this.peerConnection = null;
  }

  // Called when the connection drops mid-session (not via our own close()).
  // Debounced against reconnectTimer since onconnectionstatechange and
  // dataChannel.onclose can both fire for the same drop.
  private scheduleReconnect(): void {
    if (this.isClosing || this.reconnectTimer) {
      return;
    }
    this.teardownConnection();

    if (!this.refreshClientSecret || this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      logger.warn("transcription.reconnect_exhausted", { attempt: String(this.reconnectAttempt) });
      this.callbacks.onStateChange("disconnected");
      return;
    }

    const attempt = this.reconnectAttempt;
    this.reconnectAttempt += 1;
    const delay = RECONNECT_BACKOFF_MS[attempt] ?? RECONNECT_BACKOFF_MS[RECONNECT_BACKOFF_MS.length - 1];
    logger.warn("transcription.reconnecting", { attempt: String(attempt), delayMs: String(delay) });
    this.callbacks.onStateChange("reconnecting");

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.attemptReconnect();
    }, delay);
  }

  private async attemptReconnect(): Promise<void> {
    if (this.isClosing || !this.refreshClientSecret) {
      return;
    }
    try {
      const freshSecret = await this.refreshClientSecret();
      if (this.isClosing) {
        // close() ran while awaiting a fresh token — the caller no longer
        // wants this session, don't spend a round-trip opening a connection
        // for it.
        return;
      }
      await this.openConnection(freshSecret);
      if (this.isClosing) {
        // close() ran while the SDP exchange was in flight. openConnection()
        // already stood up a live connection by this point — tear it down
        // instead of reporting "connected" for a session the caller already
        // asked to stop.
        this.teardownConnection();
        return;
      }
      this.reconnectAttempt = 0;
      this.callbacks.onStateChange("connected");
    } catch {
      if (this.isClosing) {
        return;
      }
      logger.warn("transcription.reconnect_attempt_failed", { attempt: String(this.reconnectAttempt) });
      this.scheduleReconnect();
    }
  }

  updateTargetLanguage(language: TargetLanguage): void {
    void language;
    // No-op: this client only transcribes. Translation direction is chosen
    // per-call when the finalize flow requests a text translation.
  }

  commitUtterance(): Promise<TranscriptionCommitResult> {
    if (this.dataChannel?.readyState !== "open") {
      // Committing without a live channel would silently produce a
      // "fallback" result from whatever text happened to be buffered (or
      // nothing at all) without ever reaching the server — the caller needs
      // to know this failed outright, not treat it as a normal empty
      // utterance.
      return Promise.reject(new Error("Cannot commit utterance: DataChannel is not open"));
    }
    this.dataChannel.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    return this.tracker.commit();
  }

  async close(): Promise<void> {
    this.isClosing = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.tracker.flushAll();
    this.teardownConnection();
    this.callbacks.onStateChange("disconnected");
  }

  // Public so tests can feed synthetic DataChannel messages without a real
  // WebRTC connection.
  handleServerEvent(raw: string): void {
    let event: TranscriptionServerEvent;
    try {
      event = JSON.parse(raw);
    } catch {
      return;
    }

    switch (event.type) {
      case "conversation.item.input_audio_transcription.delta":
        if (typeof event.item_id === "string" && typeof event.delta === "string") {
          this.tracker.appendDelta(event.item_id, event.delta);
          this.callbacks.onSourceDelta(event.delta);
        } else {
          // Diagnostic: if the real API's delta event shape doesn't match
          // what we assumed (e.g. a different field name for item_id), this
          // event is silently dropped — nothing gets committed to the
          // tracker and every downstream commit/translate step ends up
          // starting from empty text. Surface the mismatch so it shows up
          // in the browser console instead of failing silently. Logs only
          // field presence/type and the event's key names — never the raw
          // payload, which would include the actual transcribed speech.
          logger.warn("transcription.delta_missing_fields", eventShapeFields(event));
        }
        break;
      case "input_audio_buffer.committed":
        if (typeof event.item_id === "string") {
          this.tracker.noteCommitted(event.item_id);
        } else {
          logger.warn("transcription.committed_missing_item_id", eventShapeFields(event));
        }
        break;
      case "conversation.item.input_audio_transcription.completed":
        if (typeof event.item_id === "string" && typeof event.transcript === "string") {
          this.tracker.resolveCompleted(event.item_id, event.transcript);
        } else {
          logger.warn("transcription.completed_missing_fields", eventShapeFields(event));
        }
        break;
      case "error": {
        // Committing an empty/too-small buffer is a routine, non-fatal
        // condition (e.g. the silence detector fired on a near-silent
        // utterance) — the pending commit's timeout fallback already
        // resolves it with whatever text was accumulated, so surfacing a
        // fatal session error here would be misleading. Only escalate
        // errors that aren't this known/expected shape.
        const isEmptyBufferCommit = /buffer (is )?(too small|empty)/i.test(raw);
        if (isEmptyBufferCommit) {
          logger.warn("transcription.empty_buffer_commit", { raw: raw.slice(0, 200) });
          break;
        }
        logger.error("transcription.server_event_error", { raw: raw.slice(0, 200) });
        this.callbacks.onError({
          code: "REALTIME_API_ERROR",
          message: "翻訳中にエラーが発生しました",
        });
        break;
      }
      default:
        if (!this.warnedUnhandledEventTypes.has(event.type)) {
          this.warnedUnhandledEventTypes.add(event.type);
          logger.warn("transcription.unhandled_event", { type: event.type });
        }
        break;
    }
  }
}
