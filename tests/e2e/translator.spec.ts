import { expect, test } from "@playwright/test";

async function stubMicrophoneTone(
  page: import("@playwright/test").Page,
  options: { silentAfterMs?: number } = {},
): Promise<void> {
  await page.addInitScript((silentAfterMs) => {
    const audioContext = new AudioContext();
    void audioContext.resume();
    const destination = audioContext.createMediaStreamDestination();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = 440;
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start();
    gain.gain.setValueAtTime(0.8, audioContext.currentTime);
    if (typeof silentAfterMs === "number") {
      gain.gain.setValueAtTime(0, audioContext.currentTime + silentAfterMs / 1000);
    }

    const fakeStream = destination.stream;
    navigator.mediaDevices.getUserMedia = async () => fakeStream;
  }, options.silentAfterMs);
}

test("starts translation in mock mode and streams subtitles", async ({ page }) => {
  await stubMicrophoneTone(page);
  await page.goto("/");

  await expect(page.getByText("モックモード")).toBeVisible();

  await page.getByRole("button", { name: "翻訳を開始" }).click();

  const sourceTexts = page.getByText("今日は横浜に行きます。");
  await expect(sourceTexts.first()).toBeVisible({ timeout: 10_000 });

  const translatedTexts = page.getByText("I'm going to Yokohama today.");
  await expect(translatedTexts.first()).toBeVisible({ timeout: 10_000 });
});

test("shows a microphone permission error when access is denied", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Permission denied", "NotAllowedError");
    };
  });
  await page.goto("/");

  await page.getByRole("button", { name: "翻訳を開始" }).click();

  await expect(page.getByText("マイクの利用が許可されていません")).toBeVisible({ timeout: 10_000 });
});

test("shows the source language rotated 180 degrees in the top pane", async ({ page }) => {
  await page.goto("/");

  const panes = page.locator("section[aria-label$='の字幕']");
  await expect(panes).toHaveCount(2);

  const topPane = panes.first();
  await expect(topPane).toHaveClass(/rotate-180/);
});

test("can enable auto-detect and still stream subtitles normally", async ({ page }) => {
  await stubMicrophoneTone(page);
  await page.goto("/");

  await page.getByRole("switch", { name: "自動（実験的）" }).click({ force: true });
  await page.getByRole("button", { name: "翻訳を開始" }).click();

  const sourceTexts = page.getByText("今日は横浜に行きます。");
  await expect(sourceTexts.first()).toBeVisible({ timeout: 10_000 });
});

test("finalizes and saves an utterance after real silence is detected", async ({ page, baseURL }) => {
  await stubMicrophoneTone(page, { silentAfterMs: 3000 });
  await page.goto("/");

  await page.getByRole("button", { name: "翻訳を開始" }).click();

  await expect(page.getByText("状態: 発話中")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("状態: 入力待ち")).toBeVisible({ timeout: 10_000 });

  const deviceId = await page.evaluate(() =>
    window.localStorage.getItem("realtime-translator:device-id"),
  );
  expect(deviceId).toBeTruthy();

  const response = await page.request.get(`${baseURL}/api/conversations?deviceId=${deviceId}`);
  const body = await response.json();

  expect(body.success).toBe(true);
  expect(body.data.length).toBeGreaterThan(0);
  expect(body.data[0].utteranceCount).toBeGreaterThan(0);
});
