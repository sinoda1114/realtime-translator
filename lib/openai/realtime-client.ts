import type {
  TargetLanguage,
  TranslationClient,
  TranslationClientCallbacks,
  TranslationClientConnectInput,
} from "@/types/translation";
import type { RealtimeServerEvent } from "./realtime-types";
import { logger } from "@/lib/logger";

const SDP_ENDPOINT = "https://api.openai.com/v1/realtime/translations/calls";

export class RealtimeTranslationClient implements TranslationClient {
  private readonly callbacks: TranslationClientCallbacks;
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private readonly warnedUnhandledEventTypes = new Set<string>();
  private stream: MediaStream | null = null;
  private refreshClientSecret: ((targetLanguage: TargetLanguage) => Promise<string>) | null = null;
  private isClosing = false;
  // Bumped by teardownConnection() and captured locally by each
  // openConnection() call — see the identical mechanism (and its rationale)
  // in transcription-client.ts. Prevents a stale event from a connection
  // already replaced by a language switch from tearing down the new one.
  private connectionGeneration = 0;
  // Guards against out-of-order language switches: if the user flips the
  // language button twice in quick succession, only the most recently
  // requested switch should be allowed to land as "connected".
  private switchSeq = 0;

  constructor(callbacks: TranslationClientCallbacks) {
    this.callbacks = callbacks;
  }

  async connect(input: TranslationClientConnectInput): Promise<void> {
    this.stream = input.stream;
    this.refreshClientSecret = input.refreshClientSecret ?? null;
    this.isClosing = false;
    // Defensive, mirroring close(): a switch left over from a previous
    // connect()/close() cycle on this same instance (not how this app's
    // hook actually uses the class today, but not forbidden by the class's
    // own contract either) must not be able to land against this new
    // session.
    this.switchSeq += 1;

    this.callbacks.onStateChange("connecting");
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
  // decide how to react.
  private async openConnection(clientSecret: string): Promise<void> {
    const stream = this.stream;
    if (!stream) {
      throw new Error("Cannot connect: no media stream available");
    }

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
        this.callbacks.onStateChange("disconnected");
      }
    };

    for (const track of stream.getAudioTracks()) {
      pc.addTrack(track, stream);
    }

    const dataChannel = pc.createDataChannel("oai-events");
    this.dataChannel = dataChannel;
    dataChannel.onmessage = (event: MessageEvent<string>) => this.handleServerEvent(event.data);

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
      logger.error("realtime.sdp_exchange_failed", { status: response.status });
      throw new Error(`SDP_EXCHANGE_FAILED_${response.status}`);
    }

    const answerSdp = await response.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
  }

  // expectedGeneration ties a teardown call to the specific connection its
  // caller is responsible for. Without it, a stale/superseded switch
  // attempt cleaning up after itself could close a NEWER connection that's
  // since taken over this.peerConnection/this.dataChannel (e.g. two rapid
  // language switches racing: the first one's post-openConnection cleanup
  // running after the second one has already connected). Pass no argument
  // for an unconditional teardown (close(), or replacing whatever is
  // currently live before starting a fresh attempt).
  private teardownConnection(expectedGeneration?: number): void {
    if (expectedGeneration !== undefined && expectedGeneration !== this.connectionGeneration) {
      return; // a newer connection has already taken over — nothing of ours to close
    }
    this.connectionGeneration += 1;
    this.dataChannel?.close();
    this.dataChannel = null;
    this.peerConnection?.close();
    this.peerConnection = null;
  }

  // The translation endpoint has no documented way to hint or change the
  // source language mid-stream, and a session is one continuous stream with
  // no per-utterance boundary (the same architectural limitation that
  // motivated building the v2 engine). Sending session.update for just
  // audio.output.language left the model's rolling context — and its
  // auto-detection of the source language — still biased toward whichever
  // language the session started with: reported on a real device as good
  // translation quality in the initial direction, then noticeably
  // worse/slower/off after pressing the other language button, in both
  // switch directions. Reconnecting with a brand-new session configured for
  // the new target language from scratch avoids that bias entirely, at the
  // cost of a brief (sub-second) audio gap during the switch — surfaced to
  // the UI as the existing "reconnecting" state.
  updateTargetLanguage(language: TargetLanguage): void {
    void this.reconnectForLanguageSwitch(language);
  }

  private async reconnectForLanguageSwitch(language: TargetLanguage): Promise<void> {
    if (this.isClosing || !this.refreshClientSecret) {
      return;
    }
    const seq = ++this.switchSeq;
    this.callbacks.onStateChange("reconnecting");

    // openConnection() claims this exact generation number as its very
    // first action, synchronously, before its first await — so as long as
    // nothing else can run between computing this and calling
    // openConnection() (true here: no await in between), it's guaranteed to
    // match. Captured up front (rather than changing openConnection()'s
    // return type) so both the stale-check below AND the catch block can
    // clean up only the connection THIS attempt created.
    let myGeneration: number | null = null;
    try {
      const freshSecret = await this.refreshClientSecret(language);
      if (this.isClosing || seq !== this.switchSeq) {
        // Closed, or a newer switch superseded this one, while awaiting the
        // token — nothing of ours was created yet, safe to just bail.
        return;
      }
      // Tear down whatever session is currently live — this switch is
      // about to replace it. Unconditional is correct here: the seq check
      // just above already guarantees no newer switch exists yet (one
      // would have bumped switchSeq past our seq), so whatever is live
      // right now cannot belong to a newer attempt.
      this.teardownConnection();
      myGeneration = this.connectionGeneration + 1;
      await this.openConnection(freshSecret);
      if (this.isClosing || seq !== this.switchSeq) {
        // Superseded or closed while the SDP exchange was in flight — close
        // only OUR OWN connection (myGeneration), never a newer one that
        // may have since taken over.
        this.teardownConnection(myGeneration);
        return;
      }
      this.callbacks.onStateChange("connected");
    } catch {
      // openConnection() may have partially set up a peer connection/data
      // channel before failing (e.g. the SDP fetch itself rejected) — clean
      // up whatever this attempt created instead of leaving it dangling.
      if (myGeneration !== null) {
        this.teardownConnection(myGeneration);
      }
      if (this.isClosing || seq !== this.switchSeq) {
        return;
      }
      logger.error("realtime.language_switch_failed", {});
      this.callbacks.onError({
        code: "REALTIME_API_ERROR",
        message: "翻訳中にエラーが発生しました",
      });
      this.callbacks.onStateChange("error");
    }
  }

  async close(): Promise<void> {
    this.isClosing = true;
    // Invalidates any language switch still awaiting a token/SDP exchange
    // so it can never land against a session established by a later
    // connect() call on this same instance (isClosing alone wouldn't catch
    // that case, since connect() resets isClosing back to false).
    this.switchSeq += 1;
    this.teardownConnection();
    this.callbacks.onStateChange("disconnected");
  }

  private handleServerEvent(raw: string): void {
    let event: RealtimeServerEvent;
    try {
      event = JSON.parse(raw);
    } catch {
      return;
    }

    switch (event.type) {
      case "session.input_transcript.delta":
        if ("delta" in event && typeof event.delta === "string") {
          const elapsedMs = typeof event.elapsed_ms === "number" ? event.elapsed_ms : undefined;
          this.callbacks.onSourceDelta(event.delta, elapsedMs);
        }
        break;
      case "session.output_transcript.delta":
        if ("delta" in event && typeof event.delta === "string") {
          const elapsedMs = typeof event.elapsed_ms === "number" ? event.elapsed_ms : undefined;
          this.callbacks.onTranslationDelta(event.delta, elapsedMs);
        }
        break;
      case "error": {
        logger.error("realtime.server_event_error", { raw: raw.slice(0, 200) });
        this.callbacks.onError({
          code: "REALTIME_API_ERROR",
          message: "翻訳中にエラーが発生しました",
        });
        break;
      }
      default:
        // Diagnostic: if the real API sends event types/shapes we don't
        // recognize, we currently drop them silently — this surfaces them
        // in the browser console (this class only ever runs client-side)
        // so a mismatch against our assumed event schema is visible. Warn
        // once per distinct type per connection to avoid log spam if an
        // unhandled event fires repeatedly (e.g. a heartbeat/ping type).
        if (!this.warnedUnhandledEventTypes.has(event.type)) {
          this.warnedUnhandledEventTypes.add(event.type);
          logger.warn("realtime.unhandled_event", { type: event.type });
        }
        break;
    }
  }
}
