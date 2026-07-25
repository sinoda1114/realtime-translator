import { describe, expect, test } from "vitest";
import {
  createAutoDetectState,
  detectLanguage,
  updateAutoDetectState,
} from "@/lib/translation/language-detector";

describe("detectLanguage", () => {
  test("detects Japanese when hiragana is present", () => {
    expect(detectLanguage("こんにちは").language).toBe("ja");
  });

  test("detects Japanese when kanji is present", () => {
    expect(detectLanguage("横浜に行きます").language).toBe("ja");
  });

  test("detects Japanese when katakana is present", () => {
    expect(detectLanguage("コンピューター").language).toBe("ja");
  });

  test("detects English when latin letters dominate", () => {
    expect(detectLanguage("I am going to Yokohama").language).toBe("en");
  });

  test("holds as unknown for text shorter than 4 characters", () => {
    expect(detectLanguage("abc").language).toBe("unknown");
  });

  test("holds as unknown for digits and symbols only", () => {
    expect(detectLanguage("12345!!").language).toBe("unknown");
  });

  test("holds as unknown for short interjections", () => {
    expect(detectLanguage("uh").language).toBe("unknown");
  });

  test("holds as unknown for short Latin loanwords that can appear mid-Japanese-sentence", () => {
    // "WiFi", "AI", "Zoom", brand names, etc. are common inside otherwise
    // Japanese speech and must not be mistaken for a language switch.
    expect(detectLanguage("WiFi").language).toBe("unknown");
    expect(detectLanguage("Zoom").language).toBe("unknown");
  });

  test("detects English for short genuine replies", () => {
    // Short standalone English replies ("Hello", "Sorry") must still be
    // detectable so auto-detect can flip en->ja for brief responses.
    expect(detectLanguage("Hello").language).toBe("en");
    expect(detectLanguage("Sorry").language).toBe("en");
  });

  test("returns a confidence between 0 and 1", () => {
    const detection = detectLanguage("Hello there");
    expect(detection.confidence).toBeGreaterThan(0);
    expect(detection.confidence).toBeLessThanOrEqual(1);
  });
});

describe("updateAutoDetectState", () => {
  test("does not confirm on the first matching detection", () => {
    const state = createAutoDetectState();
    const result = updateAutoDetectState(state, { language: "ja", confidence: 1 });

    expect(result.confirmed).toBeNull();
  });

  test("confirms once the same language is detected twice in a row", () => {
    const state = createAutoDetectState();
    const first = updateAutoDetectState(state, { language: "ja", confidence: 1 });
    const second = updateAutoDetectState(first.state, { language: "ja", confidence: 1 });

    expect(second.confirmed).toBe("ja");
  });

  test("restarts the streak when the detected language changes", () => {
    const state = createAutoDetectState();
    const first = updateAutoDetectState(state, { language: "ja", confidence: 1 });
    const second = updateAutoDetectState(first.state, { language: "en", confidence: 1 });

    expect(second.confirmed).toBeNull();
    expect(second.state.consecutiveCount).toBe(1);
  });

  test("resets the streak when detection is unknown", () => {
    const state = createAutoDetectState();
    const first = updateAutoDetectState(state, { language: "ja", confidence: 1 });
    const second = updateAutoDetectState(first.state, { language: "unknown", confidence: 0 });
    const third = updateAutoDetectState(second.state, { language: "ja", confidence: 1 });

    expect(third.confirmed).toBeNull();
    expect(third.state.consecutiveCount).toBe(1);
  });
});
