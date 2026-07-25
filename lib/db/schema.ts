import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const devices = sqliteTable(
  "devices",
  {
    id: text("id").primaryKey(),
    deviceHash: text("device_hash").notNull(),
    createdAt: integer("created_at").notNull(),
    lastSeenAt: integer("last_seen_at").notNull(),
  },
  (table) => [uniqueIndex("devices_device_hash_uidx").on(table.deviceHash)],
);

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    deviceId: text("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    mode: text("mode", { enum: ["manual", "auto"] }).notNull(),
    startedAt: integer("started_at").notNull(),
    endedAt: integer("ended_at"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("conversations_device_started_idx").on(table.deviceId, table.startedAt)],
);

export const utterances = sqliteTable(
  "utterances",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    sourceLanguage: text("source_language", { enum: ["ja", "en"] }).notNull(),
    targetLanguage: text("target_language", { enum: ["ja", "en"] }).notNull(),
    sourceText: text("source_text").notNull(),
    translatedText: text("translated_text").notNull(),
    startedOffsetMs: integer("started_offset_ms").notNull(),
    endedOffsetMs: integer("ended_offset_ms").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("utterances_conversation_created_idx").on(table.conversationId, table.createdAt),
  ],
);
