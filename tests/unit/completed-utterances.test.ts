import { describe, expect, test } from "vitest";
import {
  appendCompletedUtterance,
  MAX_VISIBLE_UTTERANCES,
} from "@/lib/translation/completed-utterances";
import type { CompletedUtterance } from "@/types/translation";

function makeUtterance(label: string): CompletedUtterance {
  return { id: label, sourceLanguage: "ja", sourceText: label, translatedText: label };
}

describe("appendCompletedUtterance", () => {
  test("appends to an empty list", () => {
    const result = appendCompletedUtterance([], makeUtterance("a"));
    expect(result.map((u) => u.id)).toEqual(["a"]);
  });

  test("keeps all entries while under the cap", () => {
    const list = ["a", "b", "c"].map(makeUtterance);
    const result = appendCompletedUtterance(list, makeUtterance("d"));
    expect(result.map((u) => u.id)).toEqual(["a", "b", "c", "d"]);
  });

  test("drops the oldest entry once the cap is exceeded", () => {
    const labels = Array.from({ length: MAX_VISIBLE_UTTERANCES }, (_, i) => `u${i}`);
    let list = labels.map(makeUtterance);
    expect(list).toHaveLength(MAX_VISIBLE_UTTERANCES);

    list = appendCompletedUtterance(list, makeUtterance("newest"));

    expect(list).toHaveLength(MAX_VISIBLE_UTTERANCES);
    expect(list[0].id).toBe("u1");
    expect(list[list.length - 1].id).toBe("newest");
    expect(list.map((u) => u.id)).not.toContain("u0");
  });
});
