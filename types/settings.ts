export type FontSizePreset = "small" | "medium" | "large" | "extra-large";
export type SilenceDurationMs = 600 | 900 | 1200 | 1500;
export type UiLanguage = "ja" | "en";

export interface LocalSettings {
  fontSize: FontSizePreset;
  silenceDurationMs: SilenceDurationMs;
  autoDetectDefault: boolean;
  uiLanguage: UiLanguage;
}
