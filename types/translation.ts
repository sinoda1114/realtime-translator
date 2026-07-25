export type SourceLanguage = "ja" | "en";
export type TargetLanguage = "ja" | "en";
export type Direction = "ja-to-en" | "en-to-ja";

export type TranslationSessionState =
  | "idle"
  | "requesting_permission"
  | "connecting"
  | "listening"
  | "speaking"
  | "finalizing"
  | "saving"
  | "reconnecting"
  | "stopping"
  | "stopped"
  | "error"
  | "mock";

export type RealtimeConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export interface CompletedUtterance {
  id: string;
  sourceLanguage: SourceLanguage;
  sourceText: string;
  translatedText: string;
}

export interface ActiveUtterance {
  sourceLanguage: SourceLanguage;
  targetLanguage: TargetLanguage;
  sourceText: string;
  translatedText: string;
  startedAtMs: number | null;
  lastAudioAtMs: number | null;
  isFinalizing: boolean;
}

export type TranslationClientErrorCode =
  | "MICROPHONE_DENIED"
  | "MICROPHONE_UNAVAILABLE"
  | "REALTIME_TOKEN_FAILED"
  | "REALTIME_DISCONNECTED"
  | "REALTIME_API_ERROR"
  | "DB_SAVE_FAILED"
  | "INVALID_REQUEST";

export interface TranslationClientError {
  code: TranslationClientErrorCode;
  message: string;
}

export interface TranslationClientCallbacks {
  onSourceDelta: (delta: string, elapsedMs?: number) => void;
  onTranslationDelta: (delta: string, elapsedMs?: number) => void;
  onStateChange: (state: RealtimeConnectionState) => void;
  onError: (error: TranslationClientError) => void;
}

export interface TranslationClientConnectInput {
  clientSecret: string;
  stream: MediaStream;
  targetLanguage: TargetLanguage;
  /**
   * v2 (transcription) client only: called to obtain a fresh client secret
   * when reconnecting after the WebRTC connection drops mid-session. The
   * original clientSecret is single-use for the initial SDP exchange and
   * can't be reused. Optional because v1's translation client and the mock
   * client never attempt reconnection.
   */
  refreshClientSecret?: () => Promise<string>;
}

export interface TranscriptionCommitResult {
  transcript: string;
  source: "completed" | "fallback";
}

export interface TranslationClient {
  connect(input: TranslationClientConnectInput): Promise<void>;
  updateTargetLanguage(language: TargetLanguage): void;
  close(): Promise<void>;
  /**
   * v2 (transcription + server-side translate) clients only. Commits the
   * current audio buffer and resolves with the authoritative transcript for
   * the utterance that just ended. Its presence is the capability check
   * useTranslationSession uses to route finalize through the v2 flow — the
   * v1 client and MockTranslationClient don't implement it.
   */
  commitUtterance?(): Promise<TranscriptionCommitResult>;
}
