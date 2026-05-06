import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { installAuthMocks, resetSupabaseMocks, supabaseAuthMocks } from './_mocks';

import { __resetRateLimitsForTests } from '@/features/auth/lib/rate-limit';

installAuthMocks();

const { signupAction } = await import('@/features/auth/actions/signup');
const { logoutAction } = await import('@/features/auth/actions/logout');
const { forgotPasswordAction } = await import('@/features/auth/actions/forgot-password');
const { resetPasswordAction } = await import('@/features/auth/actions/reset-password');
const { resendVerificationAction } = await import('@/features/auth/actions/resend-verification');

const IDLE = { status: 'idle' as const };

beforeEach(() => {
  resetSupabaseMocks();
  __resetRateLimitsForTests();
});

afterEach(() => {
  resetSupabaseMocks();
  __resetRateLimitsForTests();
});

function form(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

describe('signupAction', () => {
  const valid = {
    email: 'new@example.com',
    password: 'goodpass1',
    confirmPassword: 'goodpass1',
    acceptedTos: 'true',
  };

  it('rejects missing ToS acceptance', async () => {
    const result = await signupAction(IDLE, form({ ...valid, acceptedTos: 'false' }));
    expect(result.status).toBe('error');
  });

  it('rejects mismatched passwords', async () => {
    const result = await signupAction(IDLE, form({ ...valid, confirmPassword: 'different1' }));
    expect(result.status).toBe('error');
  });

  it('redirects to /verify-email on success', async () => {
    supabaseAuthMocks.signUp.mockResolvedValueOnce({ data: {}, error: null });
    await expect(signupAction(IDLE, form(valid))).rejects.toThrow(/NEXT_REDIRECT:\/verify-email/);
  });

  it('maps user_already_registered to CONFLICT', async () => {
    supabaseAuthMocks.signUp.mockResolvedValueOnce({
      data: {},
      error: { code: 'user_already_registered', message: 'leak' },
    });
    const result = await signupAction(IDLE, form(valid));
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.code).toBe('CONFLICT');
  });
});

describe('logoutAction', () => {
  it('redirects to /login regardless of supabase outcome', async () => {
    supabaseAuthMocks.signOut.mockResolvedValueOnce({ error: null });
    await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT:/login');
  });

  it('still redirects to /login even if signOut fails', async () => {
    supabaseAuthMocks.signOut.mockResolvedValueOnce({ error: { code: 'fail' } });
    await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT:/login');
  });
});

describe('forgotPasswordAction', () => {
  it('rejects malformed email', async () => {
    const result = await forgotPasswordAction(IDLE, form({ email: 'nope' }));
    expect(result.status).toBe('error');
  });

  it('returns generic success even on supabase error (no email enumeration)', async () => {
    supabaseAuthMocks.resetPasswordForEmail.mockResolvedValueOnce({
      data: {},
      error: { code: 'user_not_found', message: 'leak' },
    });
    const result = await forgotPasswordAction(IDLE, form({ email: 'a@b.com' }));
    expect(result.status).toBe('success');
  });

  it('surfaces RATE_LIMITED from upstream', async () => {
    supabaseAuthMocks.resetPasswordForEmail.mockResolvedValueOnce({
      data: {},
      error: { code: 'over_email_send_rate_limit', message: 'wait' },
    });
    const result = await forgotPasswordAction(IDLE, form({ email: 'a@b.com' }));
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.code).toBe('RATE_LIMITED');
  });

  it('returns generic success on actual success', async () => {
    supabaseAuthMocks.resetPasswordForEmail.mockResolvedValueOnce({
      data: {},
      error: null,
    });
    const result = await forgotPasswordAction(IDLE, form({ email: 'a@b.com' }));
    expect(result.status).toBe('success');
  });
});

describe('resetPasswordAction', () => {
  it('rejects mismatched new passwords', async () => {
    const result = await resetPasswordAction(
      IDLE,
      form({ password: 'newpass1', confirmPassword: 'differ1' }),
    );
    expect(result.status).toBe('error');
  });

  it('redirects to /chat on success', async () => {
    supabaseAuthMocks.updateUser.mockResolvedValueOnce({ data: {}, error: null });
    await expect(
      resetPasswordAction(IDLE, form({ password: 'newpass1', confirmPassword: 'newpass1' })),
    ).rejects.toThrow('NEXT_REDIRECT:/chat');
  });

  it('surfaces error on supabase failure', async () => {
    supabaseAuthMocks.updateUser.mockResolvedValueOnce({
      data: {},
      error: { code: 'session_not_found', message: 'leak' },
    });
    const result = await resetPasswordAction(
      IDLE,
      form({ password: 'newpass1', confirmPassword: 'newpass1' }),
    );
    expect(result.status).toBe('error');
  });
});

describe('resendVerificationAction', () => {
  it('rejects malformed email', async () => {
    const result = await resendVerificationAction(IDLE, form({ email: 'nope' }));
    expect(result.status).toBe('error');
  });

  it('returns success message on resend', async () => {
    supabaseAuthMocks.resend.mockResolvedValueOnce({ data: {}, error: null });
    const result = await resendVerificationAction(IDLE, form({ email: 'a@b.com' }));
    expect(result.status).toBe('success');
  });

  it('maps over_email_send_rate_limit to RATE_LIMITED', async () => {
    supabaseAuthMocks.resend.mockResolvedValueOnce({
      data: {},
      error: { code: 'over_email_send_rate_limit', message: 'leak' },
    });
    const result = await resendVerificationAction(IDLE, form({ email: 'a@b.com' }));
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.code).toBe('RATE_LIMITED');
  });
});
