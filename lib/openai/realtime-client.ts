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

  constructor(callbacks: TranslationClientCallbacks) {
    this.callbacks = callbacks;
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
        logger.error("realtime.sdp_exchange_failed", { status: response.status });
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
    this.dataChannel?.send(
      JSON.stringify({
        type: "session.update",
        session: { audio: { output: { language } } },
      }),
    );
  }

  async close(): Promise<void> {
    this.dataChannel?.close();
    this.dataChannel = null;
    this.peerConnection?.close();
    this.peerConnection = null;
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
          this.callbacks.onSourceDelta(event.delta);
        }
        break;
      case "session.output_transcript.delta":
        if ("delta" in event && typeof event.delta === "string") {
          this.callbacks.onTranslationDelta(event.delta);
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
        break;
    }
  }
}
