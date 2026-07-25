import { NextResponse } from "next/server";
import { ApiError } from "./errors";

export function jsonSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data, error: null }, { status });
}

export function jsonError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { success: false, data: null, error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  return NextResponse.json(
    {
      success: false,
      data: null,
      error: { code: "DB_SAVE_FAILED", message: "予期しないエラーが発生しました" },
    },
    { status: 500 },
  );
}
