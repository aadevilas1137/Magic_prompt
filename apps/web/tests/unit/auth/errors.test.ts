import { AppError, ErrorCode } from '@magic-prompt/shared';
import { describe, expect, it } from 'vitest';

import { __AUTH_ERROR_CODES_FOR_TESTS, mapSupabaseAuthError } from '@/features/auth/lib/errors';

interface FakeAuthError extends Error {
  code?: string;
}

function fakeError(code: string, message = 'raw'): FakeAuthError {
  const err = new Error(message) as FakeAuthError;
  err.code = code;
  return err;
}

describe('mapSupabaseAuthError', () => {
  it('returns INTERNAL_ERROR for null / undefined input', () => {
    const a = mapSupabaseAuthError(null);
    const b = mapSupabaseAuthError(undefined);
    expect(a.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(b.code).toBe(ErrorCode.INTERNAL_ERROR);
  });

  it('maps invalid_credentials to UNAUTHORIZED with a non-leaky message', () => {
    const result = mapSupabaseAuthError(fakeError('invalid_credentials'));
    expect(result).toBeInstanceOf(AppError);
    expect(result.code).toBe(ErrorCode.UNAUTHORIZED);
    expect(result.message).toBe('Email or password is incorrect.');
    expect(result.metadata).toEqual({ supabaseCode: 'invalid_credentials' });
  });

  it('maps user_already_registered to CONFLICT', () => {
    const result = mapSupabaseAuthError(fakeError('user_already_registered'));
    expect(result.code).toBe(ErrorCode.CONFLICT);
  });

  it('maps over_email_send_rate_limit to RATE_LIMITED', () => {
    const result = mapSupabaseAuthError(fakeError('over_email_send_rate_limit'));
    expect(result.code).toBe(ErrorCode.RATE_LIMITED);
  });

  it('maps weak_password to VALIDATION_ERROR', () => {
    const result = mapSupabaseAuthError(fakeError('weak_password'));
    expect(result.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it('falls back to INTERNAL_ERROR for unknown codes — never leaks raw message', () => {
    const result = mapSupabaseAuthError(fakeError('totally_unknown_code', 'raw secret'));
    expect(result.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(result.message).toBe('Something went wrong. Please try again.');
    expect(result.metadata).toEqual({ supabaseCode: 'totally_unknown_code' });
  });

  it('attaches the original error as cause for server-side logging', () => {
    const original = fakeError('invalid_credentials', 'raw');
    const result = mapSupabaseAuthError(original);
    // .cause is exposed via Error's standard property
    expect((result as Error & { cause?: unknown }).cause).toBe(original);
  });

  it('exposes the supported codes for documentation tests', () => {
    expect(__AUTH_ERROR_CODES_FOR_TESTS).toContain('invalid_credentials');
    expect(__AUTH_ERROR_CODES_FOR_TESTS).toContain('email_not_confirmed');
    expect(__AUTH_ERROR_CODES_FOR_TESTS).toContain('user_already_registered');
    expect(__AUTH_ERROR_CODES_FOR_TESTS).toContain('weak_password');
    expect(__AUTH_ERROR_CODES_FOR_TESTS).toContain('over_email_send_rate_limit');
  });
});
