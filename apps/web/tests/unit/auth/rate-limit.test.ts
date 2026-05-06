import { afterEach, describe, expect, it } from 'vitest';

import {
  RateLimits,
  __resetRateLimitsForTests,
  checkRateLimit,
} from '@/features/auth/lib/rate-limit';

afterEach(() => {
  __resetRateLimitsForTests();
});

describe('checkRateLimit', () => {
  it('allows up to `max` calls and blocks the next one', () => {
    const config = { max: 3, windowMs: 60_000 };
    const a = checkRateLimit('login', '1.1.1.1', config);
    const b = checkRateLimit('login', '1.1.1.1', config);
    const c = checkRateLimit('login', '1.1.1.1', config);
    const d = checkRateLimit('login', '1.1.1.1', config);

    expect(a.allowed).toBe(true);
    expect(a.remaining).toBe(2);
    expect(b.allowed).toBe(true);
    expect(b.remaining).toBe(1);
    expect(c.allowed).toBe(true);
    expect(c.remaining).toBe(0);
    expect(d.allowed).toBe(false);
    expect(d.remaining).toBe(0);
    expect(d.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('keys are independent per IP', () => {
    const config = { max: 1, windowMs: 60_000 };
    expect(checkRateLimit('login', '1.1.1.1', config).allowed).toBe(true);
    expect(checkRateLimit('login', '2.2.2.2', config).allowed).toBe(true);
    expect(checkRateLimit('login', '1.1.1.1', config).allowed).toBe(false);
    expect(checkRateLimit('login', '2.2.2.2', config).allowed).toBe(false);
  });

  it('keys are independent per endpoint name', () => {
    const config = { max: 1, windowMs: 60_000 };
    expect(checkRateLimit('login', '1.1.1.1', config).allowed).toBe(true);
    expect(checkRateLimit('signup', '1.1.1.1', config).allowed).toBe(true);
    expect(checkRateLimit('login', '1.1.1.1', config).allowed).toBe(false);
    expect(checkRateLimit('signup', '1.1.1.1', config).allowed).toBe(false);
  });

  it('exposes pre-configured limits with sane defaults', () => {
    expect(RateLimits.login.max).toBe(5);
    expect(RateLimits.login.windowMs).toBe(15 * 60 * 1000);
    expect(RateLimits.signup.max).toBe(3);
    expect(RateLimits.forgotPassword.max).toBe(3);
    expect(RateLimits.resendVerification.max).toBe(3);
  });

  it('resets allow status after the window expires', async () => {
    const config = { max: 1, windowMs: 50 };
    expect(checkRateLimit('test', 'k', config).allowed).toBe(true);
    expect(checkRateLimit('test', 'k', config).allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 70));
    expect(checkRateLimit('test', 'k', config).allowed).toBe(true);
  });
});
