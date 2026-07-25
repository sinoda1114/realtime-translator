export type FontSizePreset = "small" | "medium" | "large" | "extra-large";
export type SilenceDurationMs = 600 | 900 | 1200 | 1500;
export type UiLanguage = "ja" | "en";
export type ThemeMode = "light" | "dark";
/**
 * "facing": two mirrored panes (top rotated 180°) for people sitting
 * across from each other — the original design.
 * "shared": a single upright pane for people sitting side by side who
 * view the screen from the same angle — no rotation, no duplication.
 */
export type ViewMode = "facing" | "shared";
/**
 * "v1": the translation-endpoint client (gpt-realtime-translate). Streams
 * source + translated text together, but the API has no per-utterance id,
 * so the two streams can drift out of sync under real-world conditions.
 * "v2" (experimental): a transcription-only session (gpt-realtime-whisper)
 * paired with a server-side text translation call per finalized utterance —
 * slower (translation appears ~1-2s after the utterance ends, not live) but
 * the source/translation pairing is guaranteed correct.
 */
export type TranslationEngine = "v1" | "v2";

export interface LocalSettings {
  fontSize: FontSizePreset;
  silenceDurationMs: SilenceDurationMs;
  autoDetectDefault: boolean;
  uiLanguage: UiLanguage;
  theme: ThemeMode;
  viewMode: ViewMode;
  showSourceText: boolean;
  translationEngine: TranslationEngine;
  /**
   * Shows the in-app diagnostic log panel on the translator screen. For
   * investigating failures that only reproduce on a phone, where a browser
   * console isn't reachable. Off by default.
   */
  showDiagnostics: boolean;
}
