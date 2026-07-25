import { afterEach, describe, expect, test, vi } from "vitest";
import { requestTranslation, TranslateApiError } from "@/lib/translation/translate-api";

describe("requestTranslation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("returns the translated text on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { translatedText: "Hello" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestTranslation({
      text: "こんにちは",
      sourceLanguage: "ja",
      targetLanguage: "en",
      deviceId: "device-1",
    });

    expect(result).toBe("Hello");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/translate",
      expect.objectContaining({ method: "POST" }),
    );
  });

  test("throws TranslateApiError when the response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({}) }),
    );

    await expect(
      requestTranslation({
        text: "hello",
        sourceLanguage: "en",
        targetLanguage: "ja",
        deviceId: "device-1",
      }),
    ).rejects.toThrow(TranslateApiError);
  });

  test("throws TranslateApiError when the response has no translated text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) }),
    );

    await expect(
      requestTranslation({
        text: "hello",
        sourceLanguage: "en",
        targetLanguage: "ja",
        deviceId: "device-1",
      }),
    ).rejects.toThrow(TranslateApiError);
  });
});
