import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { jsonError, jsonSuccess } from "@/lib/api/responses";
import { translateRequestSchema } from "@/lib/api/validation";
import { isOpenAiConfigured } from "@/lib/env";
import { translateText } from "@/lib/openai/translate-text";
import { getClientKey } from "@/lib/security/client-key";
import { hashDeviceId } from "@/lib/security/device-hash";
import { checkRateLimit } from "@/lib/security/rate-limit";

const RATE_LIMIT = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(
      `translate:${getClientKey(request)}`,
      RATE_LIMIT,
      RATE_LIMIT_WINDOW_MS,
    );
    if (!rateLimit.allowed) {
      throw new ApiError("RATE_LIMITED", "リクエストが多すぎます。しばらくしてから再試行してください");
    }

    const body = await request.json().catch(() => null);
    const parsed = translateRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("INVALID_REQUEST", "入力内容が不正です");
    }

    if (!isOpenAiConfigured) {
      return jsonSuccess({ translatedText: `[mock] ${parsed.data.text}`, mock: true });
    }

    const safetyIdentifier = hashDeviceId(parsed.data.deviceId);

    let translatedText: string;
    try {
      translatedText = await translateText({
        text: parsed.data.text,
        sourceLanguage: parsed.data.sourceLanguage,
        targetLanguage: parsed.data.targetLanguage,
        safetyIdentifier,
      });
    } catch {
      throw new ApiError("TRANSLATE_FAILED", "翻訳に失敗しました");
    }

    return jsonSuccess({ translatedText, mock: false });
  } catch (error) {
    return jsonError(error);
  }
}
