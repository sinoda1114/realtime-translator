import { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { ApiError } from "@/lib/api/errors";
import { jsonError, jsonSuccess } from "@/lib/api/responses";
import { endConversationSchema, listConversationsQuerySchema } from "@/lib/api/validation";
import { deleteConversation, endConversation, findDeviceRowId, getConversation } from "@/lib/db/queries";
import { isTursoConfigured } from "@/lib/env";
import { getClientKey } from "@/lib/security/client-key";
import { checkRateLimit } from "@/lib/security/rate-limit";

const MUTATION_RATE_LIMIT = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

interface RouteParams {
  params: Promise<{ conversationId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    if (!isTursoConfigured) {
      throw new ApiError("DB_UNAVAILABLE", "データベースが設定されていません");
    }

    const { conversationId } = await params;
    const parsed = listConversationsQuerySchema.safeParse({
      deviceId: request.nextUrl.searchParams.get("deviceId"),
    });
    if (!parsed.success) {
      throw new ApiError("INVALID_REQUEST", "入力内容が不正です");
    }

    const db = getDb();
    const deviceRowId = await findDeviceRowId(db, parsed.data.deviceId);
    if (!deviceRowId) {
      throw new ApiError("NOT_FOUND", "会話が見つかりません");
    }

    const conversation = await getConversation(db, conversationId, deviceRowId);
    if (!conversation) {
      throw new ApiError("NOT_FOUND", "会話が見つかりません");
    }

    return jsonSuccess(conversation);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    if (!isTursoConfigured) {
      throw new ApiError("DB_UNAVAILABLE", "データベースが設定されていません");
    }

    const rateLimit = checkRateLimit(
      `conversations:patch:${getClientKey(request)}`,
      MUTATION_RATE_LIMIT,
      RATE_LIMIT_WINDOW_MS,
    );
    if (!rateLimit.allowed) {
      throw new ApiError("RATE_LIMITED", "リクエストが多すぎます。しばらくしてから再試行してください");
    }

    const { conversationId } = await params;
    const deviceId = request.headers.get("x-device-id");
    if (!deviceId) {
      throw new ApiError("INVALID_REQUEST", "端末IDが指定されていません");
    }

    const body = await request.json().catch(() => null);
    const parsed = endConversationSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("INVALID_REQUEST", "入力内容が不正です");
    }

    const db = getDb();
    const deviceRowId = await findDeviceRowId(db, deviceId);
    if (!deviceRowId) {
      throw new ApiError("NOT_FOUND", "会話が見つかりません");
    }

    const updated = await endConversation(db, conversationId, deviceRowId, parsed.data.endedAt);
    if (!updated) {
      throw new ApiError("NOT_FOUND", "会話が見つかりません");
    }

    return jsonSuccess({ id: conversationId, endedAt: parsed.data.endedAt });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    if (!isTursoConfigured) {
      throw new ApiError("DB_UNAVAILABLE", "データベースが設定されていません");
    }

    const rateLimit = checkRateLimit(
      `conversations:delete:${getClientKey(request)}`,
      MUTATION_RATE_LIMIT,
      RATE_LIMIT_WINDOW_MS,
    );
    if (!rateLimit.allowed) {
      throw new ApiError("RATE_LIMITED", "リクエストが多すぎます。しばらくしてから再試行してください");
    }

    const { conversationId } = await params;
    const deviceId = request.headers.get("x-device-id");
    if (!deviceId) {
      throw new ApiError("INVALID_REQUEST", "端末IDが指定されていません");
    }

    const db = getDb();
    const deviceRowId = await findDeviceRowId(db, deviceId);
    if (!deviceRowId) {
      throw new ApiError("NOT_FOUND", "会話が見つかりません");
    }

    const deleted = await deleteConversation(db, conversationId, deviceRowId);
    if (!deleted) {
      throw new ApiError("NOT_FOUND", "会話が見つかりません");
    }

    return jsonSuccess({ id: conversationId });
  } catch (error) {
    return jsonError(error);
  }
}
