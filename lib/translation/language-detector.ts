export type DetectedLanguage = "ja" | "en" | "unknown";

export interface LanguageDetection {
  language: DetectedLanguage;
  confidence: number;
}

const JAPANESE_CHAR_PATTERN = /[぀-ゟ゠-ヿ一-鿿]/;
const JAPANESE_CHAR_PATTERN_GLOBAL = /[぀-ゟ゠-ヿ一-鿿]/g;
const LATIN_LETTER_PATTERN_GLOBAL = /[A-Za-z]/g;
// A single kana/kanji character is an unambiguous Japanese signal, so this
// stays short. Latin script needs a longer run before we call it English —
// short Latin fragments (2-4 chars: "AI", "OK", "PC", "Zoom", a brand name,
// a number transcribed with letters) are extremely common *inside* Japanese
// speech and would otherwise false-positive a language switch mid-sentence.
// 5 chars clears the worst offenders while still catching short genuine
// English replies ("Hello", "Sorry" are both 5 chars).
const MIN_LENGTH_FOR_JA_DETECTION = 4;
const MIN_LENGTH_FOR_EN_DETECTION = 5;
const LATIN_DOMINANCE_RATIO = 0.5;

export function detectLanguage(text: string): LanguageDetection {
  const trimmed = text.trim();

  if (trimmed.length < MIN_LENGTH_FOR_JA_DETECTION) {
    return { language: "unknown", confidence: 0 };
  }

  if (JAPANESE_CHAR_PATTERN.test(trimmed)) {
    const japaneseCharCount = (trimmed.match(JAPANESE_CHAR_PATTERN_GLOBAL) ?? []).length;
    return { language: "ja", confidence: Math.min(1, japaneseCharCount / trimmed.length) };
  }

  if (trimmed.length < MIN_LENGTH_FOR_EN_DETECTION) {
    return { language: "unknown", confidence: 0 };
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
