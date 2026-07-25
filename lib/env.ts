import { z } from "zod";

function emptyToUndefined(value: unknown): unknown {
  return value === "" ? undefined : value;
}

const optionalString = () => z.preprocess(emptyToUndefined, z.string().min(1).optional());

const serverEnvSchema = z.object({
  OPENAI_API_KEY: optionalString(),
  TURSO_DATABASE_URL: optionalString(),
  TURSO_AUTH_TOKEN: optionalString(),
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  DEVICE_ID_HASH_SALT: optionalString(),
  // Text model used by the v2 translation engine's server-side /api/translate
  // call. Model naming shifts frequently — verify this id is still current
  // against OpenAI's docs before relying on it in production.
  OPENAI_TRANSLATE_TEXT_MODEL: z.preprocess(emptyToUndefined, z.string().min(1).default("gpt-5-nano")),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("Realtime Translator"),
  NEXT_PUBLIC_ENABLE_MOCK_TRANSLATION: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
});

function parseServerEnv() {
  const parsed = serverEnvSchema.safeParse({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
    APP_ENV: process.env.APP_ENV,
    DEVICE_ID_HASH_SALT: process.env.DEVICE_ID_HASH_SALT,
    OPENAI_TRANSLATE_TEXT_MODEL: process.env.OPENAI_TRANSLATE_TEXT_MODEL,
  });

  if (!parsed.success) {
    throw new Error(`Invalid server environment variables: ${parsed.error.message}`);
  }

  return parsed.data;
}

function parseClientEnv() {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_ENABLE_MOCK_TRANSLATION: process.env.NEXT_PUBLIC_ENABLE_MOCK_TRANSLATION,
  });

  if (!parsed.success) {
    throw new Error(`Invalid client environment variables: ${parsed.error.message}`);
  }

  return parsed.data;
}

export const serverEnv = parseServerEnv();
export const clientEnv = parseClientEnv();

export const isOpenAiConfigured = Boolean(serverEnv.OPENAI_API_KEY);
export const isTursoConfigured = Boolean(
  serverEnv.TURSO_DATABASE_URL && serverEnv.TURSO_AUTH_TOKEN,
);
