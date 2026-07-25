import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { jsonError, jsonSuccess } from "@/lib/api/responses";
import { isOpenAiConfigured } from "@/lib/env";
import { createTranslationClientSecret } from "@/lib/openai/client-secret";
import { createTranscriptionClientSecret } from "@/lib/openai/transcription-secret";
import { getClientKey } from "@/lib/security/client-key";
import { hashDeviceId } from "@/lib/security/device-hash";
import { checkRateLimit } from "@/lib/security/rate-limit";

const requestSchema = z.object({
  targetLanguage: z.enum(["ja", "en"]),
  deviceId: z.string().min(1),
  // v1 = the translation endpoint (gpt-realtime-translate), v2 = a
  // transcription-only session (gpt-realtime-whisper) paired with
  // server-side text translation via /api/translate.
  engine: z.enum(["v1", "v2"]).default("v1"),
});

const RATE_LIMIT = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(
      `realtime:token:${getClientKey(request)}`,
      RATE_LIMIT,
      RATE_LIMIT_WINDOW_MS,
    );
    if (!rateLimit.allowed) {
      throw new ApiError("RATE_LIMITED", "リクエストが多すぎます。しばらくしてから再試行してください");
    }

    const body = await request.json().catch(() => null);
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("INVALID_REQUEST", "入力内容が不正です");
    }

    if (!isOpenAiConfigured) {
      return jsonSuccess({ clientSecret: null, expiresAt: null, mock: true });
    }

    const safetyIdentifier = hashDeviceId(parsed.data.deviceId);

    let secret;
    try {
      secret =
        parsed.data.engine === "v2"
          ? await createTranscriptionClientSecret({ safetyIdentifier })
          : await createTranslationClientSecret({
              targetLanguage: parsed.data.targetLanguage,
              safetyIdentifier,
            });
    } catch {
      throw new ApiError("REALTIME_TOKEN_FAILED", "翻訳セッションを開始できません");
    }

    return jsonSuccess({ clientSecret: secret.value, expiresAt: secret.expires_at, mock: false });
  } catch (error) {
    return jsonError(error);
  }
}
