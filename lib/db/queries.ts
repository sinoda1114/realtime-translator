import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "./client";
import { conversations, devices, utterances } from "./schema";
import { hashDeviceId } from "@/lib/security/device-hash";
import type {
  Conversation,
  ConversationDetail,
  ConversationMode,
  ConversationSummary,
  Utterance,
  UtteranceLanguage,
} from "@/types/conversation";

export async function findDeviceRowId(
  db: Database,
  rawDeviceId: string,
): Promise<string | null> {
  const deviceHash = hashDeviceId(rawDeviceId);
  const existing = await db.query.devices.findFirst({
    where: eq(devices.deviceHash, deviceHash),
  });
  return existing?.id ?? null;
}

export async function getOrCreateDevice(
  db: Database,
  rawDeviceId: string,
  now: number,
): Promise<string> {
  const deviceHash = hashDeviceId(rawDeviceId);

  const existing = await db.query.devices.findFirst({
    where: eq(devices.deviceHash, deviceHash),
  });

  if (existing) {
    await db.update(devices).set({ lastSeenAt: now }).where(eq(devices.id, existing.id));
    return existing.id;
  }

  const id = randomUUID();
  await db.insert(devices).values({
    id,
    deviceHash,
    createdAt: now,
    lastSeenAt: now,
  });
  return id;
}

export interface CreateConversationInput {
  deviceRowId: string;
  mode: ConversationMode;
  startedAt: number;
  now: number;
}

export async function createConversation(
  db: Database,
  input: CreateConversationInput,
): Promise<Conversation> {
  const id = randomUUID();
  const conversation: Conversation = {
    id,
    deviceId: input.deviceRowId,
    mode: input.mode,
    startedAt: input.startedAt,
    endedAt: null,
    createdAt: input.now,
  };

  await db.insert(conversations).values(conversation);
  return conversation;
}

export async function endConversation(
  db: Database,
  conversationId: string,
  deviceRowId: string,
  endedAt: number,
): Promise<boolean> {
  const result = await db
    .update(conversations)
    .set({ endedAt })
    .where(and(eq(conversations.id, conversationId), eq(conversations.deviceId, deviceRowId)))
    .returning({ id: conversations.id });

  return result.length > 0;
}

export interface CreateUtteranceInput {
  conversationId: string;
  deviceRowId: string;
  sourceLanguage: UtteranceLanguage;
  targetLanguage: UtteranceLanguage;
  sourceText: string;
  translatedText: string;
  startedOffsetMs: number;
  endedOffsetMs: number;
  now: number;
}

export async function createUtterance(
  db: Database,
  input: CreateUtteranceInput,
): Promise<Utterance | null> {
  const owns = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.id, input.conversationId),
      eq(conversations.deviceId, input.deviceRowId),
    ),
  });

  if (!owns) {
    return null;
  }

  const id = randomUUID();
  const utterance: Utterance = {
    id,
    conversationId: input.conversationId,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    sourceText: input.sourceText,
    translatedText: input.translatedText,
    startedOffsetMs: input.startedOffsetMs,
    endedOffsetMs: input.endedOffsetMs,
    createdAt: input.now,
  };

  await db.insert(utterances).values(utterance);
  return utterance;
}

export async function listConversations(
  db: Database,
  deviceRowId: string,
): Promise<ConversationSummary[]> {
  const rows = await db.query.conversations.findMany({
    where: eq(conversations.deviceId, deviceRowId),
    orderBy: (row, { desc }) => [desc(row.startedAt)],
  });

  if (rows.length === 0) {
    return [];
  }

  const conversationIds = rows.map((row) => row.id);
  const allUtterances = await db.query.utterances.findMany({
    where: inArray(utterances.conversationId, conversationIds),
    orderBy: (row, { asc }) => [asc(row.createdAt)],
  });

  const byConversation = new Map<string, Utterance[]>();
  for (const utterance of allUtterances) {
    const list = byConversation.get(utterance.conversationId) ?? [];
    list.push(utterance);
    byConversation.set(utterance.conversationId, list);
  }

  return rows.map((row) => {
    const list = byConversation.get(row.id) ?? [];
    const first = list[0];
    return {
      ...row,
      utteranceCount: list.length,
      firstSourceText: first?.sourceText ?? null,
      firstTranslatedText: first?.translatedText ?? null,
    };
  });
}

export async function getConversation(
  db: Database,
  conversationId: string,
  deviceRowId: string,
): Promise<ConversationDetail | null> {
  const conversation = await db.query.conversations.findFirst({
    where: and(eq(conversations.id, conversationId), eq(conversations.deviceId, deviceRowId)),
  });

  if (!conversation) {
    return null;
  }

  const conversationUtterances = await db.query.utterances.findMany({
    where: eq(utterances.conversationId, conversationId),
    orderBy: (row, { asc }) => [asc(row.createdAt)],
  });

  return { ...conversation, utterances: conversationUtterances };
}

export async function deleteConversation(
  db: Database,
  conversationId: string,
  deviceRowId: string,
): Promise<boolean> {
  const owns = await db.query.conversations.findFirst({
    where: and(eq(conversations.id, conversationId), eq(conversations.deviceId, deviceRowId)),
  });

  if (!owns) {
    return false;
  }

  await db.delete(utterances).where(eq(utterances.conversationId, conversationId));
  await db.delete(conversations).where(eq(conversations.id, conversationId));
  return true;
}

export async function deleteAllConversationsForDevice(
  db: Database,
  deviceRowId: string,
): Promise<number> {
  const rows = await db.query.conversations.findMany({
    where: eq(conversations.deviceId, deviceRowId),
    columns: { id: true },
  });

  const ids = rows.map((row) => row.id);
  if (ids.length === 0) {
    return 0;
  }

  await db.delete(utterances).where(inArray(utterances.conversationId, ids));
  await db.delete(conversations).where(inArray(conversations.id, ids));
  return ids.length;
}
