import { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { ApiError } from "@/lib/api/errors";
import { jsonError, jsonSuccess } from "@/lib/api/responses";
import { createConversationSchema, listConversationsQuerySchema } from "@/lib/api/validation";
import {
  createConversation,
  deleteAllConversationsForDevice,
  findDeviceRowId,
  getOrCreateDevice,
  listConversations,
} from "@/lib/db/queries";
import { isTursoConfigured } from "@/lib/env";
import { getClientKey } from "@/lib/security/client-key";
import { checkRateLimit } from "@/lib/security/rate-limit";

const CREATE_RATE_LIMIT = 20;
const MUTATION_RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(request: NextRequest) {
  try {
    if (!isTursoConfigured) {
      throw new ApiError("DB_UNAVAILABLE", "データベースが設定されていません");
    }

    const rateLimit = checkRateLimit(
      `conversations:create:${getClientKey(request)}`,
      CREATE_RATE_LIMIT,
      RATE_LIMIT_WINDOW_MS,
    );
    if (!rateLimit.allowed) {
      throw new ApiError("RATE_LIMITED", "リクエストが多すぎます。しばらくしてから再試行してください");
    }

    const body = await request.json().catch(() => null);
    const parsed = createConversationSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("INVALID_REQUEST", "入力内容が不正です");
    }

    const db = getDb();
    const now = Date.now();
    const deviceRowId = await getOrCreateDevice(db, parsed.data.deviceId, now);
    const conversation = await createConversation(db, {
      deviceRowId,
      mode: parsed.data.mode,
      startedAt: now,
      now,
    });

    return jsonSuccess(conversation, 201);
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!isTursoConfigured) {
      throw new ApiError("DB_UNAVAILABLE", "データベースが設定されていません");
    }

    const parsed = listConversationsQuerySchema.safeParse({
      deviceId: request.nextUrl.searchParams.get("deviceId"),
    });
    if (!parsed.success) {
      throw new ApiError("INVALID_REQUEST", "入力内容が不正です");
    }

    const db = getDb();
    const deviceRowId = await findDeviceRowId(db, parsed.data.deviceId);
    if (!deviceRowId) {
      return jsonSuccess([]);
    }

    const summaries = await listConversations(db, deviceRowId);
    return jsonSuccess(summaries);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isTursoConfigured) {
      throw new ApiError("DB_UNAVAILABLE", "データベースが設定されていません");
    }

    const rateLimit = checkRateLimit(
      `conversations:delete-all:${getClientKey(request)}`,
      MUTATION_RATE_LIMIT,
      RATE_LIMIT_WINDOW_MS,
    );
    if (!rateLimit.allowed) {
      throw new ApiError("RATE_LIMITED", "リクエストが多すぎます。しばらくしてから再試行してください");
    }

    const deviceId = request.headers.get("x-device-id");
    if (!deviceId) {
      throw new ApiError("INVALID_REQUEST", "端末IDが指定されていません");
    }

    const db = getDb();
    const deviceRowId = await findDeviceRowId(db, deviceId);
    if (!deviceRowId) {
      return jsonSuccess({ deletedCount: 0 });
    }

    const deletedCount = await deleteAllConversationsForDevice(db, deviceRowId);
    return jsonSuccess({ deletedCount });
  } catch (error) {
    return jsonError(error);
  }
}
