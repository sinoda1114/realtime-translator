import { z } from "zod";

const DEVICE_ID_MAX_LENGTH = 200;
const UTTERANCE_TEXT_MAX_LENGTH = 4_000;

const deviceIdSchema = z.string().min(1).max(DEVICE_ID_MAX_LENGTH);

export const createConversationSchema = z.object({
  deviceId: deviceIdSchema,
  mode: z.enum(["manual", "auto"]),
});

export const endConversationSchema = z.object({
  endedAt: z.number().int().positive(),
});

export const createUtteranceSchema = z
  .object({
    deviceId: deviceIdSchema,
    sourceLanguage: z.enum(["ja", "en"]),
    targetLanguage: z.enum(["ja", "en"]),
    sourceText: z.string().min(1).max(UTTERANCE_TEXT_MAX_LENGTH),
    translatedText: z.string().min(1).max(UTTERANCE_TEXT_MAX_LENGTH),
    startedOffsetMs: z.number().int().nonnegative(),
    endedOffsetMs: z.number().int().nonnegative(),
  })
  .refine((data) => data.endedOffsetMs >= data.startedOffsetMs, {
    message: "endedOffsetMs must not be before startedOffsetMs",
    path: ["endedOffsetMs"],
  });

export const listConversationsQuerySchema = z.object({
  deviceId: deviceIdSchema,
});
