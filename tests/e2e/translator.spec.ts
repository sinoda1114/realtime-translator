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

test("auto-detect is on by default and streaming still works", async ({ page }) => {
  // Auto-detect defaults to on so realtime conversation works without
  // manual language taps; verify the settings switch reflects that and
  // that streaming still works with it enabled.
  await page.goto("/settings");
  await expect(
    page.getByRole("switch", { name: "起動時に自動判定を有効にする" }),
  ).toBeChecked();

  await stubMicrophoneTone(page);
  await page.goto("/");
  await page.getByRole("button", { name: "翻訳を開始" }).click();

  const sourceTexts = page.getByText("今日は横浜に行きます。");
  await expect(sourceTexts.first()).toBeVisible({ timeout: 10_000 });
});

test("hides the manual language pills while auto-detect is on, shows them once it's off", async ({
  page,
}) => {
  // Auto-detect (日英会話モード) is the primary way to use this app, so the
  // manual pills would otherwise be a confusing, purposeless control for
  // most users. They should only appear once auto-detect is explicitly
  // turned off and a source language must be set manually.
  await page.goto("/");
  await expect(page.getByRole("button", { name: "日本語" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "English" })).toHaveCount(0);

  await page.goto("/settings");
  await page.getByRole("switch", { name: "起動時に自動判定を有効にする" }).click({ force: true });

  await page.goto("/");
  await expect(page.getByRole("button", { name: "日本語" })).toBeVisible();
  await expect(page.getByRole("button", { name: "English" })).toBeVisible();
});

test("finalizes and saves an utterance after real silence is detected", async ({ page, baseURL }) => {
  await stubMicrophoneTone(page, { silentAfterMs: 3000 });
  await page.goto("/");
  await page.getByRole("button", { name: "翻訳を開始" }).click();

  // Session progress is now conveyed by the session button itself (label +
  // dot), not a separate "状態: X" text line, so wait on the button label
  // instead: it stays "翻訳を停止" through speaking/listening/finalizing.
  await expect(page.getByRole("button", { name: "翻訳を停止" })).toBeVisible({ timeout: 10_000 });

  const deviceId = await page.evaluate(() =>
    window.localStorage.getItem("realtime-translator:device-id"),
  );
  expect(deviceId).toBeTruthy();

  await expect(async () => {
    const response = await page.request.get(`${baseURL}/api/conversations?deviceId=${deviceId}`);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].utteranceCount).toBeGreaterThan(0);
  }).toPass({ timeout: 15_000 });

  // The finalized exchange must stay visible on screen — both speakers keep
  // a short scrollback log instead of the pane clearing back to blank the
  // moment silence resets the live buffer.
  await expect(page.getByText("今日は横浜に行きます。").first()).toBeVisible();
  await expect(page.getByText("I'm going to Yokohama today.").first()).toBeVisible();
});

test("hides the original text when toggled, keeping the translation visible", async ({ page }) => {
  await stubMicrophoneTone(page);
  await page.goto("/");

  await page.getByRole("button", { name: "翻訳を開始" }).click();

  const sourceTexts = page.getByText("今日は横浜に行きます。");
  const translatedTexts = page.getByText("I'm going to Yokohama today.");
  await expect(sourceTexts.first()).toBeVisible({ timeout: 10_000 });
  await expect(translatedTexts.first()).toBeVisible({ timeout: 10_000 });

  // The control bar auto-collapses once a session goes active; re-expand it
  // to reach the toggle button inside.
  const controlsToggle = page.locator('button[aria-controls="translator-controls-panel"]');
  if ((await controlsToggle.getAttribute("aria-expanded")) === "false") {
    await controlsToggle.click();
  }

  await page.getByRole("button", { name: "原文を隠す" }).click();

  await expect(sourceTexts.first()).toBeHidden();
  await expect(translatedTexts.first()).toBeVisible();
});
