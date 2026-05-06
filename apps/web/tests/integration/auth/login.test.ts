import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { installAuthMocks, resetSupabaseMocks, supabaseAuthMocks } from './_mocks';

import { __resetRateLimitsForTests } from '@/features/auth/lib/rate-limit';

installAuthMocks();

const { loginAction } = await import('@/features/auth/actions/login');
const IDLE = { status: 'idle' as const };

afterEach(() => {
  resetSupabaseMocks();
  __resetRateLimitsForTests();
});

beforeEach(() => {
  resetSupabaseMocks();
  __resetRateLimitsForTests();
});

function form(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

describe('loginAction', () => {
  it('returns validation-error state for malformed email', async () => {
    const result = await loginAction(IDLE, form({ email: 'nope', password: 'x' }));
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.fieldErrors?.email?.[0]).toBeDefined();
    }
  });

  it('returns validation-error for empty password', async () => {
    const result = await loginAction(IDLE, form({ email: 'a@b.com', password: '' }));
    expect(result.status).toBe('error');
  });

  it('redirects to /chat on successful sign-in', async () => {
    supabaseAuthMocks.signInWithPassword.mockResolvedValueOnce({ data: {}, error: null });
    await expect(loginAction(IDLE, form({ email: 'a@b.com', password: 'good' }))).rejects.toThrow(
      'NEXT_REDIRECT:/chat',
    );
  });

  it('honors a safe ?redirect= param', async () => {
    supabaseAuthMocks.signInWithPassword.mockResolvedValueOnce({ data: {}, error: null });
    await expect(
      loginAction(IDLE, form({ email: 'a@b.com', password: 'good', redirect: '/chat/abc' })),
    ).rejects.toThrow('NEXT_REDIRECT:/chat/abc');
  });

  it('rejects an external redirect (open-redirect protection)', async () => {
    supabaseAuthMocks.signInWithPassword.mockResolvedValueOnce({ data: {}, error: null });
    await expect(
      loginAction(IDLE, form({ email: 'a@b.com', password: 'good', redirect: 'https://evil.com' })),
    ).rejects.toThrow('NEXT_REDIRECT:/chat');
  });

  it('maps invalid_credentials to UNAUTHORIZED + safe message', async () => {
    supabaseAuthMocks.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: { code: 'invalid_credentials', message: 'leak' },
    });
    const result = await loginAction(IDLE, form({ email: 'a@b.com', password: 'wrong' }));
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('UNAUTHORIZED');
      expect(result.message).not.toContain('leak');
    }
  });

  it('rate-limits after 5 attempts in the window', async () => {
    supabaseAuthMocks.signInWithPassword.mockResolvedValue({
      data: {},
      error: { code: 'invalid_credentials', message: 'no' },
    });
    for (let i = 0; i < 5; i += 1) {
      await loginAction(IDLE, form({ email: 'rl@b.com', password: 'x' }));
    }
    const result = await loginAction(IDLE, form({ email: 'rl@b.com', password: 'x' }));
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.code).toBe('RATE_LIMITED');
  });
});
