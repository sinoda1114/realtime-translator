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
}

export interface TranslationClient {
  connect(input: TranslationClientConnectInput): Promise<void>;
  updateTargetLanguage(language: TargetLanguage): void;
  close(): Promise<void>;
}
