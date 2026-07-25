import { describe, expect, test } from "vitest";
import {
  appendSourceDelta,
  appendTranslationDelta,
  createEmptyTranscriptBuffer,
  getTranscriptBufferCompleteness,
  isTranscriptBufferEmpty,
  snapshotTranscriptBuffer,
} from "@/lib/translation/transcript-buffer";

describe("appendSourceDelta", () => {
  test("concatenates deltas without inserting whitespace", () => {
    const empty = createEmptyTranscriptBuffer();
    const afterFirst = appendSourceDelta(empty, "今日は");
    const afterSecond = appendSourceDelta(afterFirst, "横浜に");

    expect(afterSecond.sourceText).toBe("今日は横浜に");
  });

  test("does not mutate the original state", () => {
    const empty = createEmptyTranscriptBuffer();
    appendSourceDelta(empty, "今日は");

    expect(empty.sourceText).toBe("");
  });
});

describe("appendTranslationDelta", () => {
  test("concatenates deltas without inserting whitespace", () => {
    const empty = createEmptyTranscriptBuffer();
    const afterFirst = appendTranslationDelta(empty, "I'm going");
    const afterSecond = appendTranslationDelta(afterFirst, " to Yokohama");

    expect(afterSecond.translatedText).toBe("I'm going to Yokohama");
  });
});

describe("snapshotTranscriptBuffer", () => {
  test("trims trailing whitespace only", () => {
    const state = { sourceText: "今日は横浜に  ", translatedText: "I'm going  " };

    expect(snapshotTranscriptBuffer(state)).toEqual({
      sourceText: "今日は横浜に",
      translatedText: "I'm going",
    });
  });
});

describe("isTranscriptBufferEmpty", () => {
  test("returns true when source text is empty", () => {
    expect(isTranscriptBufferEmpty({ sourceText: "", translatedText: "hello" })).toBe(true);
  });

  test("returns true when translated text is empty", () => {
    expect(isTranscriptBufferEmpty({ sourceText: "hello", translatedText: "" })).toBe(true);
  });

  test("returns false when both are non-empty", () => {
    expect(isTranscriptBufferEmpty({ sourceText: "hello", translatedText: "world" })).toBe(false);
  });
});

describe("getTranscriptBufferCompleteness", () => {
  test("returns empty when both sides are blank", () => {
    expect(getTranscriptBufferCompleteness({ sourceText: "", translatedText: "" })).toBe("empty");
  });

  test("returns partial when only the source side has content", () => {
    expect(getTranscriptBufferCompleteness({ sourceText: "hello", translatedText: "" })).toBe(
      "partial",
    );
  });

  test("returns partial when only the translated side has content", () => {
    expect(getTranscriptBufferCompleteness({ sourceText: "", translatedText: "world" })).toBe(
      "partial",
    );
  });

  test("returns complete when both sides have content", () => {
    expect(
      getTranscriptBufferCompleteness({ sourceText: "hello", translatedText: "world" }),
    ).toBe("complete");
  });
});
