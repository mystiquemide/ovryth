/**
 * Minimal in-memory sliding-window rate limiter. Adequate for a single-instance demo;
 * a production multi-instance deployment would back this with a durable store (e.g. a
 * Postgres table or Upstash). Fails open only on process restart, never over-limits.
 */
type Hit = { count: number; resetAt: number };
const buckets = new Map<string, Hit>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt };
  }
  existing.count += 1;
  const ok = existing.count <= limit;
  return { ok, remaining: Math.max(0, limit - existing.count), resetAt: existing.resetAt };
}
