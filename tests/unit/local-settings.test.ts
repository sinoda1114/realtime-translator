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
    });

    expect(parseStoredSettings(stored)).toEqual({
      fontSize: "large",
      silenceDurationMs: 1200,
      autoDetectDefault: true,
    });
  });

  test("falls back to defaults for invalid field values", () => {
    const stored = JSON.stringify({
      fontSize: "gigantic",
      silenceDurationMs: 42,
      autoDetectDefault: "yes",
    });

    expect(parseStoredSettings(stored)).toEqual(DEFAULT_SETTINGS);
  });

  test("falls back to defaults for missing fields", () => {
    const stored = JSON.stringify({ fontSize: "small" });

    expect(parseStoredSettings(stored)).toEqual({
      ...DEFAULT_SETTINGS,
      fontSize: "small",
    });
  });
});
