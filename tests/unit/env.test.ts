import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const ENV_KEYS = [
  "OPENAI_API_KEY",
  "TURSO_DATABASE_URL",
  "TURSO_AUTH_TOKEN",
  "APP_ENV",
  "DEVICE_ID_HASH_SALT",
  "NEXT_PUBLIC_APP_NAME",
  "NEXT_PUBLIC_ENABLE_MOCK_TRANSLATION",
] as const;

const originalEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }
  vi.resetModules();
});

describe("serverEnv", () => {
  test("treats empty string OPENAI_API_KEY as not configured", async () => {
    process.env.OPENAI_API_KEY = "";
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;

    vi.resetModules();
    const { isOpenAiConfigured, serverEnv } = await import("@/lib/env");

    expect(serverEnv.OPENAI_API_KEY).toBeUndefined();
    expect(isOpenAiConfigured).toBe(false);
  });

  test("treats a non-empty OPENAI_API_KEY as configured", async () => {
    process.env.OPENAI_API_KEY = "sk-test-key";

    vi.resetModules();
    const { isOpenAiConfigured, serverEnv } = await import("@/lib/env");

    expect(serverEnv.OPENAI_API_KEY).toBe("sk-test-key");
    expect(isOpenAiConfigured).toBe(true);
  });

  test("requires both TURSO_DATABASE_URL and TURSO_AUTH_TOKEN to be configured", async () => {
    process.env.TURSO_DATABASE_URL = "libsql://example.turso.io";
    delete process.env.TURSO_AUTH_TOKEN;

    vi.resetModules();
    const { isTursoConfigured } = await import("@/lib/env");

    expect(isTursoConfigured).toBe(false);
  });
});
