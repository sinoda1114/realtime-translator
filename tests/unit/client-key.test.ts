import { describe, expect, test } from "vitest";
import { NextRequest } from "next/server";
import { getClientKey } from "@/lib/security/client-key";

function createRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/test", { headers });
}

describe("getClientKey", () => {
  test("prefers x-real-ip when present", () => {
    const request = createRequest({
      "x-real-ip": "203.0.113.9",
      "x-forwarded-for": "198.51.100.1, 203.0.113.9",
    });
    expect(getClientKey(request)).toBe("203.0.113.9");
  });

  test("uses the last entry of x-forwarded-for, not the client-supplied first entry", () => {
    const request = createRequest({
      "x-forwarded-for": "1.2.3.4, 203.0.113.9",
    });
    expect(getClientKey(request)).toBe("203.0.113.9");
  });

  test("falls back to local when no headers are present", () => {
    const request = createRequest({});
    expect(getClientKey(request)).toBe("local");
  });
});
