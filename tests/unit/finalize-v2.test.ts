import { describe, expect, test, vi } from "vitest";
import { createV2FinalizeHandler } from "@/lib/translation/finalize-v2";

function baseDeps() {
  return {
    commitUtterance: vi.fn().mockResolvedValue({ transcript: "こんにちは", source: "completed" }),
    translate: vi.fn().mockResolvedValue("Hello"),
    getSourceLanguage: vi.fn().mockReturnValue("ja" as const),
    appendCompleted: vi.fn(),
    saveUtterance: vi.fn().mockResolvedValue(undefined),
    onError: vi.fn(),
    setPhase: vi.fn(),
    createId: vi.fn().mockReturnValue("fixed-id"),
  };
}

describe("createV2FinalizeHandler", () => {
  test("commits, translates, appends, and saves in order on success", async () => {
    const deps = baseDeps();
    const finalize = createV2FinalizeHandler(deps);

    await finalize();

    expect(deps.commitUtterance).toHaveBeenCalledOnce();
    expect(deps.translate).toHaveBeenCalledWith("こんにちは", "ja", "en");
    expect(deps.appendCompleted).toHaveBeenCalledWith({
      id: "fixed-id",
      sourceLanguage: "ja",
      sourceText: "こんにちは",
      translatedText: "Hello",
    });
    expect(deps.saveUtterance).toHaveBeenCalledWith({
      sourceLanguage: "ja",
      targetLanguage: "en",
      sourceText: "こんにちは",
      translatedText: "Hello",
    });
    expect(deps.setPhase.mock.calls.map((call) => call[0])).toEqual(["finalizing", "saving", "done"]);
    expect(deps.onError).not.toHaveBeenCalled();
  });

  test("reports an error and does not translate/append/save when commitUtterance rejects", async () => {
    const deps = baseDeps();
    deps.commitUtterance.mockRejectedValue(new Error("DataChannel is not open"));
    const finalize = createV2FinalizeHandler(deps);

    await finalize();

    expect(deps.translate).not.toHaveBeenCalled();
    expect(deps.appendCompleted).not.toHaveBeenCalled();
    expect(deps.saveUtterance).not.toHaveBeenCalled();
    expect(deps.onError).toHaveBeenCalledWith("発話の確定に失敗しました");
    expect(deps.setPhase.mock.calls.map((call) => call[0])).toEqual(["finalizing", "done"]);
  });

  test("does nothing further when the committed transcript is empty", async () => {
    const deps = baseDeps();
    deps.commitUtterance.mockResolvedValue({ transcript: "   ", source: "fallback" });
    const finalize = createV2FinalizeHandler(deps);

    await finalize();

    expect(deps.translate).not.toHaveBeenCalled();
    expect(deps.appendCompleted).not.toHaveBeenCalled();
    expect(deps.saveUtterance).not.toHaveBeenCalled();
    expect(deps.setPhase.mock.calls.map((call) => call[0])).toEqual(["finalizing", "done"]);
  });

  test("reports an error and does not append/save when translation fails", async () => {
    const deps = baseDeps();
    deps.translate.mockRejectedValue(new Error("boom"));
    const finalize = createV2FinalizeHandler(deps);

    await finalize();

    expect(deps.appendCompleted).not.toHaveBeenCalled();
    expect(deps.saveUtterance).not.toHaveBeenCalled();
    expect(deps.onError).toHaveBeenCalledWith("翻訳に失敗しました");
    expect(deps.setPhase.mock.calls.map((call) => call[0])).toEqual(["finalizing", "done"]);
  });

  test("still finishes with an error when saving fails, but the pair was already shown", async () => {
    const deps = baseDeps();
    deps.saveUtterance.mockRejectedValue(new Error("db down"));
    const finalize = createV2FinalizeHandler(deps);

    await finalize();

    expect(deps.appendCompleted).toHaveBeenCalledOnce();
    expect(deps.onError).toHaveBeenCalledWith("履歴を保存できませんでした");
    expect(deps.setPhase.mock.calls.map((call) => call[0])).toEqual(["finalizing", "saving", "done"]);
  });

  test("translates a fallback-sourced transcript the same as a completed one", async () => {
    const deps = baseDeps();
    deps.commitUtterance.mockResolvedValue({ transcript: "遅延した文字起こし", source: "fallback" });
    const finalize = createV2FinalizeHandler(deps);

    await finalize();

    expect(deps.translate).toHaveBeenCalledWith("遅延した文字起こし", "ja", "en");
    expect(deps.appendCompleted).toHaveBeenCalledOnce();
  });
});
