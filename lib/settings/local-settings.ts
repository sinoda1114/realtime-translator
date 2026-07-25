import type { LocalSettings, SilenceDurationMs } from "@/types/settings";

export const SETTINGS_STORAGE_KEY = "realtime-translator:settings";

export const DEFAULT_SETTINGS: LocalSettings = {
  fontSize: "medium",
  silenceDurationMs: 900,
  autoDetectDefault: false,
  uiLanguage: "ja",
  theme: "light",
  viewMode: "facing",
};

const VALID_FONT_SIZES = new Set(["small", "medium", "large", "extra-large"]);
const VALID_SILENCE_DURATIONS = new Set<SilenceDurationMs>([600, 900, 1200, 1500]);
const VALID_UI_LANGUAGES = new Set(["ja", "en"]);
const VALID_THEMES = new Set(["light", "dark"]);
const VALID_VIEW_MODES = new Set(["facing", "shared"]);

export function parseStoredSettings(raw: string | null): LocalSettings {
  if (!raw) {
    return DEFAULT_SETTINGS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LocalSettings>;
    return {
      fontSize:
        typeof parsed.fontSize === "string" && VALID_FONT_SIZES.has(parsed.fontSize)
          ? (parsed.fontSize as LocalSettings["fontSize"])
          : DEFAULT_SETTINGS.fontSize,
      silenceDurationMs:
        typeof parsed.silenceDurationMs === "number" &&
        VALID_SILENCE_DURATIONS.has(parsed.silenceDurationMs as SilenceDurationMs)
          ? (parsed.silenceDurationMs as SilenceDurationMs)
          : DEFAULT_SETTINGS.silenceDurationMs,
      autoDetectDefault:
        typeof parsed.autoDetectDefault === "boolean"
          ? parsed.autoDetectDefault
          : DEFAULT_SETTINGS.autoDetectDefault,
      uiLanguage:
        typeof parsed.uiLanguage === "string" && VALID_UI_LANGUAGES.has(parsed.uiLanguage)
          ? (parsed.uiLanguage as LocalSettings["uiLanguage"])
          : DEFAULT_SETTINGS.uiLanguage,
      theme:
        typeof parsed.theme === "string" && VALID_THEMES.has(parsed.theme)
          ? (parsed.theme as LocalSettings["theme"])
          : DEFAULT_SETTINGS.theme,
      viewMode:
        typeof parsed.viewMode === "string" && VALID_VIEW_MODES.has(parsed.viewMode)
          ? (parsed.viewMode as LocalSettings["viewMode"])
          : DEFAULT_SETTINGS.viewMode,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export const FONT_SIZE_TOKEN: Record<LocalSettings["fontSize"], string> = {
  small: "var(--text-subtitle-sm)",
  medium: "var(--text-subtitle-md)",
  large: "var(--text-subtitle-lg)",
  "extra-large": "var(--text-subtitle-xl)",
};
