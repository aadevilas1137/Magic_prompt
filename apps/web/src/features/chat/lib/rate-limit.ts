import 'server-only';

import { LRUCache } from 'lru-cache';

/**
 * Application-layer rate limiting for chat mutations. Per-process LRU cache,
 * mirroring the auth-actions pattern (`features/auth/lib/rate-limit.ts`).
 *
 * Limits are intentionally generous — chat is the primary user surface and
 * accidental triggering is more harmful than under-protecting. The real DoS
 * defense lives at the edge (Vercel/CDN) in Phase 12+.
 */
export interface RateLimitConfig {
  readonly windowMs: number;
  readonly max: number;
}

interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
}

const buckets = new Map<string, LRUCache<string, number[]>>();

function getBucket(name: string, config: RateLimitConfig): LRUCache<string, number[]> {
  let bucket = buckets.get(name);
  if (!bucket) {
    bucket = new LRUCache<string, number[]>({
      max: 50_000,
      ttl: config.windowMs,
      ttlAutopurge: true,
    });
    buckets.set(name, bucket);
  }
  return bucket;
}

export function checkRateLimit(
  name: string,
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const bucket = getBucket(name, config);
  const cutoff = now - config.windowMs;
  const history = (bucket.get(key) ?? []).filter((ts) => ts > cutoff);

  if (history.length >= config.max) {
    const oldest = history[0] ?? now;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + config.windowMs - now) / 1000));
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }
  history.push(now);
  bucket.set(key, history);
  return {
    allowed: true,
    remaining: config.max - history.length,
    retryAfterSeconds: 0,
  };
}

export const ChatRateLimits = {
  /** Message send — 60/min/user. */
  sendMessage: { windowMs: 60 * 1000, max: 60 },
  /** Create chat — 20/hr/user. */
  createChat: { windowMs: 60 * 60 * 1000, max: 20 },
  /** Mutate (rename/delete/archive) — 60/hr/user. */
  mutate: { windowMs: 60 * 60 * 1000, max: 60 },
} as const;

/** Test-only — clears all in-process buckets between specs. */
export function __resetRateLimitsForTests(): void {
  buckets.clear();
}
