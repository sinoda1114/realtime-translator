import { expect, test } from "@playwright/test";

const DEVICE_ID = `e2e-history-${Date.now()}`;

async function seedDeviceId(page: import("@playwright/test").Page): Promise<void> {
  await page.addInitScript((deviceId) => {
    window.localStorage.setItem("realtime-translator:device-id", deviceId);
  }, DEVICE_ID);
}

async function createConversationWithUtterance(
  request: import("@playwright/test").APIRequestContext,
  baseURL: string,
): Promise<string> {
  const created = await request.post(`${baseURL}/api/conversations`, {
    data: { deviceId: DEVICE_ID, mode: "manual" },
  });
  const createdBody = await created.json();
  const conversationId = createdBody.data.id as string;

  await request.post(`${baseURL}/api/conversations/${conversationId}/utterances`, {
    data: {
      deviceId: DEVICE_ID,
      sourceLanguage: "ja",
      targetLanguage: "en",
      sourceText: "横浜に行きます",
      translatedText: "Going to Yokohama",
      startedOffsetMs: 0,
      endedOffsetMs: 2000,
    },
  });

  return conversationId;
}

test("shows an empty state when there is no history", async ({ page, baseURL }) => {
  const emptyDeviceId = `e2e-empty-${Date.now()}`;
  await page.addInitScript((deviceId) => {
    window.localStorage.setItem("realtime-translator:device-id", deviceId);
  }, emptyDeviceId);

  await page.goto(`${baseURL}/history`);

  await expect(page.getByText("まだ会話履歴がありません")).toBeVisible();
});

test("lists a saved conversation, opens its detail, and deletes it", async ({
  page,
  request,
  baseURL,
}) => {
  if (!baseURL) {
    throw new Error("baseURL is required");
  }
  await seedDeviceId(page);
  const conversationId = await createConversationWithUtterance(request, baseURL);

  await page.goto("/history");
  await expect(page.getByText("横浜に行きます")).toBeVisible();
  await expect(page.getByText("Going to Yokohama")).toBeVisible();

  await page.getByText("横浜に行きます").click();
  await expect(page).toHaveURL(new RegExp(`/history/${conversationId}$`));
  await expect(page.getByText("Going to Yokohama")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "この会話を削除" }).click();

  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByText("まだ会話履歴がありません")).toBeVisible();
});
