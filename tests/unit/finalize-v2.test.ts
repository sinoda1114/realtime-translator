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
    // Instant no-op by default so tests don't pay the real retry delay;
    // the "retries" describe block overrides this to assert on it directly.
    delay: vi.fn().mockResolvedValue(undefined),
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

  test("retries commitUtterance once after a delay, then reports an error if it fails again", async () => {
    const deps = baseDeps();
    deps.commitUtterance.mockRejectedValue(new Error("DataChannel is not open"));
    const finalize = createV2FinalizeHandler(deps);

    await finalize();

    expect(deps.commitUtterance).toHaveBeenCalledTimes(2);
    expect(deps.delay).toHaveBeenCalledWith(1500);
    expect(deps.translate).not.toHaveBeenCalled();
    expect(deps.appendCompleted).not.toHaveBeenCalled();
    expect(deps.saveUtterance).not.toHaveBeenCalled();
    expect(deps.onError).toHaveBeenCalledWith("発話の確定に失敗しました");
    expect(deps.setPhase.mock.calls.map((call) => call[0])).toEqual(["finalizing", "done"]);
  });

  // The client reconnects a dropped DataChannel in the background (see
  // transcription-client.ts's scheduleReconnect()); this covers the case
  // where that reconnect has landed by the time the single retry fires.
  test("recovers when the retried commitUtterance succeeds after a transient failure", async () => {
    const deps = baseDeps();
    deps.commitUtterance
      .mockRejectedValueOnce(new Error("DataChannel is not open"))
      .mockResolvedValueOnce({ transcript: "こんにちは", source: "completed" });
    const finalize = createV2FinalizeHandler(deps);

    await finalize();

    expect(deps.commitUtterance).toHaveBeenCalledTimes(2);
    expect(deps.onError).not.toHaveBeenCalled();
    expect(deps.translate).toHaveBeenCalledWith("こんにちは", "ja", "en");
    expect(deps.appendCompleted).toHaveBeenCalledOnce();
  });

  // Regression: delay() rejecting used to escape both try/catch blocks and
  // reject finalizeV2() itself, leaving the caller stuck in "finalizing"
  // instead of reaching the same error/done handling as a failed retry.
  test("reports the same commit error if delay() itself rejects", async () => {
    const deps = baseDeps();
    deps.commitUtterance.mockRejectedValue(new Error("DataChannel is not open"));
    deps.delay.mockRejectedValue(new Error("timer setup failed"));
    const finalize = createV2FinalizeHandler(deps);

    await expect(finalize()).resolves.toBeUndefined();

    expect(deps.commitUtterance).toHaveBeenCalledTimes(1);
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
