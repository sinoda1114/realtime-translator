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

  constructor(callbacks: TranslationClientCallbacks, options: RealtimeTranscriptionClientOptions = {}) {
    this.callbacks = callbacks;
    this.tracker = new TranscriptionCommitTracker({ commitTimeoutMs: options.commitTimeoutMs });
  }

  async connect(input: TranslationClientConnectInput): Promise<void> {
    this.callbacks.onStateChange("connecting");

    try {
      const pc = new RTCPeerConnection();
      this.peerConnection = pc;

      pc.ontrack = (event) => {
        event.streams.forEach((stream) => {
          stream.getTracks().forEach((track) => {
            track.enabled = false;
          });
        });
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          this.callbacks.onStateChange("disconnected");
        }
      };

      for (const track of input.stream.getAudioTracks()) {
        pc.addTrack(track, input.stream);
      }

      const dataChannel = pc.createDataChannel("oai-events");
      this.dataChannel = dataChannel;
      dataChannel.onmessage = (event: MessageEvent<string>) => this.handleServerEvent(event.data);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const response = await fetch(SDP_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.clientSecret}`,
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

      this.callbacks.onStateChange("connected");
    } catch {
      this.dataChannel?.close();
      this.dataChannel = null;
      this.peerConnection?.close();
      this.peerConnection = null;
      this.callbacks.onError({
        code: "REALTIME_API_ERROR",
        message: "翻訳中にエラーが発生しました",
      });
      this.callbacks.onStateChange("error");
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
    this.tracker.flushAll();
    this.dataChannel?.close();
    this.dataChannel = null;
    this.peerConnection?.close();
    this.peerConnection = null;
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
