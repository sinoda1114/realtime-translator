import { describe, expect, test } from "vitest";
import { getDirection, getTargetLanguage } from "@/lib/translation/direction";

describe("getTargetLanguage", () => {
  test("returns en when source is ja", () => {
    expect(getTargetLanguage("ja")).toBe("en");
  });

  test("returns ja when source is en", () => {
    expect(getTargetLanguage("en")).toBe("ja");
  });
});

describe("getDirection", () => {
  test("returns ja-to-en when source is ja", () => {
    expect(getDirection("ja")).toBe("ja-to-en");
  });

  test("returns en-to-ja when source is en", () => {
    expect(getDirection("en")).toBe("en-to-ja");
  });
});
