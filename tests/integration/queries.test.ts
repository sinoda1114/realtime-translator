import { beforeEach, describe, expect, test } from "vitest";
import type { Database } from "@/lib/db/client";
import {
  createConversation,
  createUtterance,
  deleteAllConversationsForDevice,
  deleteConversation,
  endConversation,
  findDeviceRowId,
  getConversation,
  getOrCreateDevice,
  listConversations,
} from "@/lib/db/queries";
import { createTestDb } from "./db-test-helpers";

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
});

describe("getOrCreateDevice", () => {
  test("returns the same internal id for the same raw device id", async () => {
    const first = await getOrCreateDevice(db, "raw-device-1", 1000);
    const second = await getOrCreateDevice(db, "raw-device-1", 2000);

    expect(second).toBe(first);
  });

  test("returns different internal ids for different raw device ids", async () => {
    const a = await getOrCreateDevice(db, "raw-device-a", 1000);
    const b = await getOrCreateDevice(db, "raw-device-b", 1000);

    expect(a).not.toBe(b);
  });
});

describe("findDeviceRowId", () => {
  test("returns null when the device does not exist yet", async () => {
    const found = await findDeviceRowId(db, "unknown-device");
    expect(found).toBeNull();
  });

  test("returns the internal id once the device has been created", async () => {
    const created = await getOrCreateDevice(db, "raw-device-1", 1000);
    const found = await findDeviceRowId(db, "raw-device-1");
    expect(found).toBe(created);
  });
});

describe("conversation and utterance lifecycle", () => {
  test("creates a conversation, saves utterances, and ends the conversation", async () => {
    const deviceRowId = await getOrCreateDevice(db, "raw-device-1", 1000);

    const conversation = await createConversation(db, {
      deviceRowId,
      mode: "manual",
      startedAt: 1000,
      now: 1000,
    });

    const utterance = await createUtterance(db, {
      conversationId: conversation.id,
      deviceRowId,
      sourceLanguage: "ja",
      targetLanguage: "en",
      sourceText: "今日は横浜に行きます。",
      translatedText: "I'm going to Yokohama today.",
      startedOffsetMs: 0,
      endedOffsetMs: 3000,
      now: 4000,
    });

    expect(utterance).not.toBeNull();
    expect(utterance?.sourceText).toBe("今日は横浜に行きます。");

    const ended = await endConversation(db, conversation.id, deviceRowId, 5000);
    expect(ended).toBe(true);

    const detail = await getConversation(db, conversation.id, deviceRowId);
    expect(detail?.endedAt).toBe(5000);
    expect(detail?.utterances).toHaveLength(1);
  });

  test("rejects utterance creation when the device does not own the conversation", async () => {
    const ownerDeviceRowId = await getOrCreateDevice(db, "owner-device", 1000);
    const otherDeviceRowId = await getOrCreateDevice(db, "other-device", 1000);

    const conversation = await createConversation(db, {
      deviceRowId: ownerDeviceRowId,
      mode: "manual",
      startedAt: 1000,
      now: 1000,
    });

    const utterance = await createUtterance(db, {
      conversationId: conversation.id,
      deviceRowId: otherDeviceRowId,
      sourceLanguage: "ja",
      targetLanguage: "en",
      sourceText: "test",
      translatedText: "test",
      startedOffsetMs: 0,
      endedOffsetMs: 100,
      now: 2000,
    });

    expect(utterance).toBeNull();
  });

  test("rejects ending a conversation owned by a different device", async () => {
    const ownerDeviceRowId = await getOrCreateDevice(db, "owner-device", 1000);
    const otherDeviceRowId = await getOrCreateDevice(db, "other-device", 1000);

    const conversation = await createConversation(db, {
      deviceRowId: ownerDeviceRowId,
      mode: "manual",
      startedAt: 1000,
      now: 1000,
    });

    const ended = await endConversation(db, conversation.id, otherDeviceRowId, 2000);
    expect(ended).toBe(false);
  });
});

describe("listConversations", () => {
  test("returns summaries with utterance count and first utterance preview", async () => {
    const deviceRowId = await getOrCreateDevice(db, "raw-device-1", 1000);

    const conversation = await createConversation(db, {
      deviceRowId,
      mode: "manual",
      startedAt: 1000,
      now: 1000,
    });

    await createUtterance(db, {
      conversationId: conversation.id,
      deviceRowId,
      sourceLanguage: "ja",
      targetLanguage: "en",
      sourceText: "今日は",
      translatedText: "Today",
      startedOffsetMs: 0,
      endedOffsetMs: 500,
      now: 1500,
    });
    await createUtterance(db, {
      conversationId: conversation.id,
      deviceRowId,
      sourceLanguage: "ja",
      targetLanguage: "en",
      sourceText: "横浜に行きます",
      translatedText: "I'm going to Yokohama",
      startedOffsetMs: 600,
      endedOffsetMs: 1200,
      now: 2000,
    });

    const summaries = await listConversations(db, deviceRowId);

    expect(summaries).toHaveLength(1);
    expect(summaries[0].utteranceCount).toBe(2);
    expect(summaries[0].firstSourceText).toBe("今日は");
    expect(summaries[0].firstTranslatedText).toBe("Today");
  });

  test("returns an empty array when the device has no conversations", async () => {
    const deviceRowId = await getOrCreateDevice(db, "raw-device-1", 1000);

    const summaries = await listConversations(db, deviceRowId);

    expect(summaries).toEqual([]);
  });

  test("does not return conversations belonging to another device", async () => {
    const deviceRowId = await getOrCreateDevice(db, "raw-device-1", 1000);
    const otherDeviceRowId = await getOrCreateDevice(db, "raw-device-2", 1000);

    await createConversation(db, {
      deviceRowId: otherDeviceRowId,
      mode: "manual",
      startedAt: 1000,
      now: 1000,
    });

    const summaries = await listConversations(db, deviceRowId);
    expect(summaries).toEqual([]);
  });
});

describe("deleteConversation", () => {
  test("deletes the conversation and its utterances", async () => {
    const deviceRowId = await getOrCreateDevice(db, "raw-device-1", 1000);
    const conversation = await createConversation(db, {
      deviceRowId,
      mode: "manual",
      startedAt: 1000,
      now: 1000,
    });
    await createUtterance(db, {
      conversationId: conversation.id,
      deviceRowId,
      sourceLanguage: "ja",
      targetLanguage: "en",
      sourceText: "test",
      translatedText: "test",
      startedOffsetMs: 0,
      endedOffsetMs: 100,
      now: 2000,
    });

    const deleted = await deleteConversation(db, conversation.id, deviceRowId);
    expect(deleted).toBe(true);

    const detail = await getConversation(db, conversation.id, deviceRowId);
    expect(detail).toBeNull();
  });

  test("returns false when the device does not own the conversation", async () => {
    const ownerDeviceRowId = await getOrCreateDevice(db, "owner-device", 1000);
    const otherDeviceRowId = await getOrCreateDevice(db, "other-device", 1000);

    const conversation = await createConversation(db, {
      deviceRowId: ownerDeviceRowId,
      mode: "manual",
      startedAt: 1000,
      now: 1000,
    });

    const deleted = await deleteConversation(db, conversation.id, otherDeviceRowId);
    expect(deleted).toBe(false);

    const detail = await getConversation(db, conversation.id, ownerDeviceRowId);
    expect(detail).not.toBeNull();
  });
});

describe("deleteAllConversationsForDevice", () => {
  test("deletes every conversation and utterance owned by the device", async () => {
    const deviceRowId = await getOrCreateDevice(db, "raw-device-1", 1000);

    const conversationA = await createConversation(db, {
      deviceRowId,
      mode: "manual",
      startedAt: 1000,
      now: 1000,
    });
    const conversationB = await createConversation(db, {
      deviceRowId,
      mode: "auto",
      startedAt: 2000,
      now: 2000,
    });
    await createUtterance(db, {
      conversationId: conversationA.id,
      deviceRowId,
      sourceLanguage: "ja",
      targetLanguage: "en",
      sourceText: "test",
      translatedText: "test",
      startedOffsetMs: 0,
      endedOffsetMs: 100,
      now: 1500,
    });

    const deletedCount = await deleteAllConversationsForDevice(db, deviceRowId);
    expect(deletedCount).toBe(2);

    const summaries = await listConversations(db, deviceRowId);
    expect(summaries).toEqual([]);

    const detailA = await getConversation(db, conversationA.id, deviceRowId);
    const detailB = await getConversation(db, conversationB.id, deviceRowId);
    expect(detailA).toBeNull();
    expect(detailB).toBeNull();
  });
});
