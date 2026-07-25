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
   * Called to obtain a fresh client secret whenever a client needs to
   * (re)establish the WebRTC session with a specific target language: v2
   * uses it to reconnect after the connection drops mid-session (target
   * language is irrelevant there — v2's session is transcription-only and
   * ignores it), and v1 uses it to reconnect with a brand-new session when
   * the user switches translation direction (target language IS the point
   * there — see updateTargetLanguage on RealtimeTranslationClient for why a
   * session.update alone isn't enough). The original clientSecret is
   * single-use for the initial SDP exchange and can't be reused for either
   * case. Optional because the mock client never attempts reconnection.
   */
  refreshClientSecret?: (targetLanguage: TargetLanguage) => Promise<string>;
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
