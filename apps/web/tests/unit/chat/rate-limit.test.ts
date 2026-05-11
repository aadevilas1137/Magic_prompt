import { afterEach, describe, expect, it } from 'vitest';

import {
  ChatRateLimits,
  __resetRateLimitsForTests,
  checkRateLimit,
} from '@/features/chat/lib/rate-limit';

afterEach(() => __resetRateLimitsForTests());

describe('chat rate-limit', () => {
  it('allows requests under the limit', () => {
    const result = checkRateLimit('sendMessage', 'user1', { windowMs: 60_000, max: 3 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.retryAfterSeconds).toBe(0);
  });

  it('blocks once the limit is exceeded', () => {
    const cfg = { windowMs: 60_000, max: 2 };
    checkRateLimit('sendMessage', 'u', cfg);
    checkRateLimit('sendMessage', 'u', cfg);
    const third = checkRateLimit('sendMessage', 'u', cfg);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('keys are isolated', () => {
    const cfg = { windowMs: 60_000, max: 1 };
    expect(checkRateLimit('sendMessage', 'a', cfg).allowed).toBe(true);
    expect(checkRateLimit('sendMessage', 'b', cfg).allowed).toBe(true);
  });

  it('exposes the three production configs', () => {
    expect(ChatRateLimits.sendMessage.max).toBe(60);
    expect(ChatRateLimits.createChat.max).toBe(20);
    expect(ChatRateLimits.mutate.max).toBe(60);
  });
});
