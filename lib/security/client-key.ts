import type { NextRequest } from "next/server";

/**
 * Derives a best-effort client identifier for rate limiting.
 *
 * `x-forwarded-for` can contain client-supplied values prepended before the
 * proxy's own entry, so the raw header must not be trusted as-is. Vercel's
 * edge appends the real connecting IP as the last entry in the chain (and
 * also sets `x-real-ip` to the same value), so prefer that over the full
 * header.
 */
export function getClientKey(request: NextRequest): string {
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const entries = forwardedFor.split(",").map((entry) => entry.trim());
    const last = entries[entries.length - 1];
    if (last) {
      return last;
    }
  }

  return "local";
}
