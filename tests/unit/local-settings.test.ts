import { describe, expect, test } from "vitest";
import { DEFAULT_SETTINGS, parseStoredSettings } from "@/lib/settings/local-settings";

describe("parseStoredSettings", () => {
  test("returns defaults when nothing is stored", () => {
    expect(parseStoredSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  test("returns defaults when stored value is invalid JSON", () => {
    expect(parseStoredSettings("not json")).toEqual(DEFAULT_SETTINGS);
  });

  test("parses a fully valid stored settings object", () => {
    const stored = JSON.stringify({
      fontSize: "large",
      silenceDurationMs: 1200,
      autoDetectDefault: true,
      uiLanguage: "en",
      theme: "dark",
      viewMode: "shared",
      showSourceText: false,
      translationEngine: "v2",
    });

    expect(parseStoredSettings(stored)).toEqual({
      fontSize: "large",
      silenceDurationMs: 1200,
      autoDetectDefault: true,
      uiLanguage: "en",
      theme: "dark",
      viewMode: "shared",
      showSourceText: false,
      translationEngine: "v2",
      showDiagnostics: false,
    });
  });

  test("falls back to defaults for invalid field values", () => {
    const stored = JSON.stringify({
      fontSize: "gigantic",
      silenceDurationMs: 42,
      autoDetectDefault: "yes",
      uiLanguage: "fr",
      theme: "sepia",
      viewMode: "grid",
      showSourceText: "nope",
      translationEngine: "v3",
      showDiagnostics: "on",
    });

    expect(parseStoredSettings(stored)).toEqual(DEFAULT_SETTINGS);
  });

  test("keeps a stored showDiagnostics value", () => {
    const stored = JSON.stringify({ showDiagnostics: true });

    expect(parseStoredSettings(stored)).toEqual({
      ...DEFAULT_SETTINGS,
      showDiagnostics: true,
    });
  });

  test("falls back to defaults for missing fields", () => {
    const stored = JSON.stringify({ fontSize: "small" });

    expect(parseStoredSettings(stored)).toEqual({
      ...DEFAULT_SETTINGS,
      fontSize: "small",
    });
  });

  test("migrates pre-theme-field settings by defaulting theme to light", () => {
    // Simulates a value saved before the theme toggle shipped.
    const stored = JSON.stringify({
      fontSize: "medium",
      silenceDurationMs: 900,
      autoDetectDefault: false,
      uiLanguage: "en",
    });

    expect(parseStoredSettings(stored)).toEqual({
      fontSize: "medium",
      silenceDurationMs: 900,
      autoDetectDefault: false,
      uiLanguage: "en",
      theme: "light",
      viewMode: "facing",
      showSourceText: true,
      translationEngine: "v1",
      showDiagnostics: false,
    });
  });

  test("migrates pre-viewMode-field settings by defaulting viewMode to facing", () => {
    // Simulates a value saved before the layout toggle shipped.
    const stored = JSON.stringify({
      fontSize: "medium",
      silenceDurationMs: 900,
      autoDetectDefault: false,
      uiLanguage: "en",
      theme: "dark",
    });

    expect(parseStoredSettings(stored)).toEqual({
      fontSize: "medium",
      silenceDurationMs: 900,
      autoDetectDefault: false,
      uiLanguage: "en",
      theme: "dark",
      viewMode: "facing",
      showSourceText: true,
      translationEngine: "v1",
      showDiagnostics: false,
    });
  });

  test("migrates pre-showSourceText-field settings by defaulting showSourceText to true", () => {
    // Simulates a value saved before the original-text toggle shipped.
    const stored = JSON.stringify({
      fontSize: "medium",
      silenceDurationMs: 900,
      autoDetectDefault: false,
      uiLanguage: "en",
      theme: "dark",
      viewMode: "shared",
    });

    expect(parseStoredSettings(stored)).toEqual({
      fontSize: "medium",
      silenceDurationMs: 900,
      autoDetectDefault: false,
      uiLanguage: "en",
      theme: "dark",
      viewMode: "shared",
      showSourceText: true,
      translationEngine: "v1",
      showDiagnostics: false,
    });
  });

  test("migrates pre-translationEngine-field settings by defaulting translationEngine to v1", () => {
    // Simulates a value saved before the v2 translation engine toggle shipped.
    const stored = JSON.stringify({
      fontSize: "medium",
      silenceDurationMs: 900,
      autoDetectDefault: false,
      uiLanguage: "en",
      theme: "dark",
      viewMode: "shared",
      showSourceText: false,
    });

    expect(parseStoredSettings(stored)).toEqual({
      fontSize: "medium",
      silenceDurationMs: 900,
      autoDetectDefault: false,
      uiLanguage: "en",
      theme: "dark",
      viewMode: "shared",
      showSourceText: false,
      translationEngine: "v1",
      showDiagnostics: false,
    });
  });
});
