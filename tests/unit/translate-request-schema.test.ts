import { describe, expect, test } from "vitest";
import { translateRequestSchema } from "@/lib/api/validation";

describe("translateRequestSchema", () => {
  test("accepts a valid ja->en request", () => {
    const result = translateRequestSchema.safeParse({
      deviceId: "device-1",
      text: "こんにちは",
      sourceLanguage: "ja",
      targetLanguage: "en",
    });
    expect(result.success).toBe(true);
  });

  test("rejects empty text", () => {
    const result = translateRequestSchema.safeParse({
      deviceId: "device-1",
      text: "",
      sourceLanguage: "ja",
      targetLanguage: "en",
    });
    expect(result.success).toBe(false);
  });

  test("rejects text over the max length", () => {
    const result = translateRequestSchema.safeParse({
      deviceId: "device-1",
      text: "a".repeat(2_001),
      sourceLanguage: "ja",
      targetLanguage: "en",
    });
    expect(result.success).toBe(false);
  });

  test("rejects when sourceLanguage equals targetLanguage", () => {
    const result = translateRequestSchema.safeParse({
      deviceId: "device-1",
      text: "hello",
      sourceLanguage: "en",
      targetLanguage: "en",
    });
    expect(result.success).toBe(false);
  });

  test("rejects an unsupported language code", () => {
    const result = translateRequestSchema.safeParse({
      deviceId: "device-1",
      text: "hello",
      sourceLanguage: "fr",
      targetLanguage: "en",
    });
    expect(result.success).toBe(false);
  });
});
