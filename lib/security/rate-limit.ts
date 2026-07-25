interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// This is a single-process, in-memory limiter: on Vercel it resets on every
// cold start and is not shared across concurrent instances, so it is only a
// best-effort guard (per spec: "最低限のレート制限"), not a hard boundary.
// The cap below bounds worst-case memory growth from an attacker cycling
// through many spoofed client keys within one warm instance's lifetime.
const MAX_BUCKETS = 5_000;

const buckets = new Map<string, RateLimitBucket>();

function evictOldestIfOverCapacity(): void {
  if (buckets.size < MAX_BUCKETS) {
    return;
  }
  const oldestKey = buckets.keys().next().value;
  if (oldestKey !== undefined) {
    buckets.delete(oldestKey);
  }
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    evictOldestIfOverCapacity();
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}
