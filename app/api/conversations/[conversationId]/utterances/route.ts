import { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { ApiError } from "@/lib/api/errors";
import { jsonError, jsonSuccess } from "@/lib/api/responses";
import { createUtteranceSchema } from "@/lib/api/validation";
import { createUtterance, findDeviceRowId } from "@/lib/db/queries";
import { isTursoConfigured } from "@/lib/env";
import { getClientKey } from "@/lib/security/client-key";
import { checkRateLimit } from "@/lib/security/rate-limit";

const CREATE_RATE_LIMIT = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;

interface RouteParams {
  params: Promise<{ conversationId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    if (!isTursoConfigured) {
      throw new ApiError("DB_UNAVAILABLE", "データベースが設定されていません");
    }

    const rateLimit = checkRateLimit(
      `utterances:create:${getClientKey(request)}`,
      CREATE_RATE_LIMIT,
      RATE_LIMIT_WINDOW_MS,
    );
    if (!rateLimit.allowed) {
      throw new ApiError("RATE_LIMITED", "リクエストが多すぎます。しばらくしてから再試行してください");
    }

    const { conversationId } = await params;
    const body = await request.json().catch(() => null);
    const parsed = createUtteranceSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("INVALID_REQUEST", "入力内容が不正です");
    }

    const db = getDb();
    const deviceRowId = await findDeviceRowId(db, parsed.data.deviceId);
    if (!deviceRowId) {
      throw new ApiError("NOT_FOUND", "会話が見つかりません");
    }

    const utterance = await createUtterance(db, {
      conversationId,
      deviceRowId,
      sourceLanguage: parsed.data.sourceLanguage,
      targetLanguage: parsed.data.targetLanguage,
      sourceText: parsed.data.sourceText,
      translatedText: parsed.data.translatedText,
      startedOffsetMs: parsed.data.startedOffsetMs,
      endedOffsetMs: parsed.data.endedOffsetMs,
      now: Date.now(),
    });

    if (!utterance) {
      throw new ApiError("NOT_FOUND", "会話が見つかりません");
    }

    return jsonSuccess(utterance, 201);
  } catch (error) {
    return jsonError(error);
  }
}
