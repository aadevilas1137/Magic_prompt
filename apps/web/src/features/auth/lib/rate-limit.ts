import { LRUCache } from 'lru-cache';

/**
 * In-memory rate limiter, backed by an `lru-cache` per endpoint name.
 *
 * **Phase 2 only.** This is a per-process, single-instance limiter — it
 * resets on every server restart and does NOT survive across multiple
 * Next.js workers / serverless instances. For the production deploy
 * (Phase 11) we'll replace the backing store with Upstash Redis or
 * similar, keeping this same `checkRateLimit` API so call sites don't
 * change.
 *
 * Keying convention: caller is responsible for picking the key (typically
 * `${ip}:${email}` or just `${ip}`). This module does not assume an IP
 * source — server actions read the request header.
 */

export interface RateLimitConfig {
  readonly max: number;
  readonly windowMs: number;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  /** Seconds until the window resets — populate in the `Retry-After` header. */
  readonly retryAfterSeconds: number;
}

const limiters = new Map<string, LRUCache<string, number>>();

function getLimiter(name: string, ttl: number): LRUCache<string, number> {
  let limiter = limiters.get(name);
  if (!limiter) {
    limiter = new LRUCache<string, number>({
      // 10k unique keys per endpoint is enough headroom for attack scenarios.
      max: 10_000,
      ttl,
      ttlAutopurge: true,
      // The TTL is per-key and resets on overwrite — set false so existing
      // entries' deadlines are NOT extended each time we increment.
      updateAgeOnGet: false,
      updateAgeOnHas: false,
    });
    limiters.set(name, limiter);
  }
  return limiter;
}

export function checkRateLimit(
  name: string,
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const limiter = getLimiter(name, config.windowMs);
  const previous = limiter.get(key) ?? 0;

  if (previous >= config.max) {
    const remainingTtl = limiter.getRemainingTTL(key);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(remainingTtl / 1000)),
    };
  }

  // Preserve the TTL on the existing entry by re-using its remaining time
  // when we set the incremented count. Otherwise lru-cache resets the TTL
  // on every set, which would let an attacker keep their counter alive.
  const remainingTtl = previous > 0 ? limiter.getRemainingTTL(key) : config.windowMs;
  limiter.set(key, previous + 1, { ttl: remainingTtl > 0 ? remainingTtl : config.windowMs });

  return {
    allowed: true,
    remaining: config.max - previous - 1,
    retryAfterSeconds: 0,
  };
}

/** Test-only: clear every limiter so units don't bleed state between cases. */
export function __resetRateLimitsForTests(): void {
  for (const limiter of limiters.values()) {
    limiter.clear();
  }
  limiters.clear();
}

/**
 * Canonical limits per auth endpoint. Adjust here, not in call sites.
 */
export const RateLimits = {
  login: { max: 5, windowMs: 15 * 60 * 1000 },
  signup: { max: 3, windowMs: 60 * 60 * 1000 },
  forgotPassword: { max: 3, windowMs: 60 * 60 * 1000 },
  resendVerification: { max: 3, windowMs: 60 * 60 * 1000 },
} as const satisfies Record<string, RateLimitConfig>;
