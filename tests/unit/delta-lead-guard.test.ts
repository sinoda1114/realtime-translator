import { describe, expect, test } from "vitest";
import { isTranslationDeltaTooFarAhead } from "@/lib/translation/delta-lead-guard";

describe("isTranslationDeltaTooFarAhead", () => {
  test("allows a translation delta within the lead limit", () => {
    expect(isTranslationDeltaTooFarAhead(1000, 2000, 3000)).toBe(false);
  });

  test("allows a translation delta that trails behind the source", () => {
    expect(isTranslationDeltaTooFarAhead(5000, 4000, 3000)).toBe(false);
  });

  test("rejects a translation delta far ahead of the most recent source delta", () => {
    expect(isTranslationDeltaTooFarAhead(1000, 5000, 3000)).toBe(true);
  });

  test("allows anything when no source delta has been seen yet", () => {
    expect(isTranslationDeltaTooFarAhead(null, 10_000, 3000)).toBe(false);
  });

  test("allows anything when the translation delta has no timing info", () => {
    expect(isTranslationDeltaTooFarAhead(1000, undefined, 3000)).toBe(false);
  });

  test("is exclusive at the exact limit boundary", () => {
    expect(isTranslationDeltaTooFarAhead(1000, 4000, 3000)).toBe(false);
    expect(isTranslationDeltaTooFarAhead(1000, 4001, 3000)).toBe(true);
  });
});
