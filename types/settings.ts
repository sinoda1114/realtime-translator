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

export interface LocalSettings {
  fontSize: FontSizePreset;
  silenceDurationMs: SilenceDurationMs;
  autoDetectDefault: boolean;
  uiLanguage: UiLanguage;
  theme: ThemeMode;
  viewMode: ViewMode;
}
