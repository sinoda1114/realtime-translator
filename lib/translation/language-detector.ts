export type DetectedLanguage = "ja" | "en" | "unknown";

export interface LanguageDetection {
  language: DetectedLanguage;
  confidence: number;
}

const JAPANESE_CHAR_PATTERN = /[぀-ゟ゠-ヿ一-鿿]/;
const JAPANESE_CHAR_PATTERN_GLOBAL = /[぀-ゟ゠-ヿ一-鿿]/g;
const LATIN_LETTER_PATTERN_GLOBAL = /[A-Za-z]/g;
const MIN_LENGTH_FOR_DETECTION = 4;
const LATIN_DOMINANCE_RATIO = 0.5;

export function detectLanguage(text: string): LanguageDetection {
  const trimmed = text.trim();

  if (trimmed.length < MIN_LENGTH_FOR_DETECTION) {
    return { language: "unknown", confidence: 0 };
  }

  if (JAPANESE_CHAR_PATTERN.test(trimmed)) {
    const japaneseCharCount = (trimmed.match(JAPANESE_CHAR_PATTERN_GLOBAL) ?? []).length;
    return { language: "ja", confidence: Math.min(1, japaneseCharCount / trimmed.length) };
  }

  const latinCharCount = (trimmed.match(LATIN_LETTER_PATTERN_GLOBAL) ?? []).length;
  const latinRatio = latinCharCount / trimmed.length;

  if (latinRatio >= LATIN_DOMINANCE_RATIO) {
    return { language: "en", confidence: latinRatio };
  }

  return { language: "unknown", confidence: 0 };
}

export interface AutoDetectState {
  lastDetected: DetectedLanguage | null;
  consecutiveCount: number;
}

export function createAutoDetectState(): AutoDetectState {
  return { lastDetected: null, consecutiveCount: 0 };
}

export interface AutoDetectUpdateResult {
  state: AutoDetectState;
  confirmed: "ja" | "en" | null;
}

export function updateAutoDetectState(
  state: AutoDetectState,
  detection: LanguageDetection,
): AutoDetectUpdateResult {
  if (detection.language === "unknown") {
    return { state: createAutoDetectState(), confirmed: null };
  }

  if (state.lastDetected !== detection.language) {
    return { state: { lastDetected: detection.language, consecutiveCount: 1 }, confirmed: null };
  }

  const consecutiveCount = state.consecutiveCount + 1;
  const nextState: AutoDetectState = { lastDetected: detection.language, consecutiveCount };

  if (consecutiveCount >= 2) {
    return { state: nextState, confirmed: detection.language };
  }

  return { state: nextState, confirmed: null };
}
