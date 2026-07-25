export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "DB_SAVE_FAILED"
  | "DB_UNAVAILABLE"
  | "REALTIME_TOKEN_FAILED";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  INVALID_REQUEST: 400,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  RATE_LIMITED: 429,
  DB_SAVE_FAILED: 500,
  DB_UNAVAILABLE: 503,
  REALTIME_TOKEN_FAILED: 502,
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}
