import { AppError, ErrorCode, type ErrorCode as ErrorCodeT } from '@magic-prompt/shared';

import type { AuthError } from '@supabase/supabase-js';

/**
 * Map Supabase auth-specific error codes to a typed `AppError` with a
 * user-facing message. **Never** let the raw Supabase message reach the
 * browser — it occasionally leaks implementation detail and is also
 * unstable across SDK versions.
 *
 * Unknown codes map to a generic INTERNAL_ERROR so the user sees a stable
 * message; the original error is attached as `cause` for server-side
 * logging via Pino.
 *
 * Reference (Supabase Auth error codes):
 * https://supabase.com/docs/reference/javascript/auth-api
 */

interface AuthErrorMapping {
  readonly code: ErrorCodeT;
  readonly message: string;
}

const AUTH_ERROR_MAP: Readonly<Record<string, AuthErrorMapping>> = {
  invalid_credentials: {
    code: ErrorCode.UNAUTHORIZED,
    message: 'Email or password is incorrect.',
  },
  email_not_confirmed: {
    code: ErrorCode.UNAUTHORIZED,
    message: 'Please verify your email before signing in. Check your inbox.',
  },
  user_already_registered: {
    code: ErrorCode.CONFLICT,
    message: 'An account with this email already exists.',
  },
  user_already_exists: {
    code: ErrorCode.CONFLICT,
    message: 'An account with this email already exists.',
  },
  weak_password: {
    code: ErrorCode.VALIDATION_ERROR,
    message: 'Password is too weak. Use at least 8 characters with letters and numbers.',
  },
  over_email_send_rate_limit: {
    code: ErrorCode.RATE_LIMITED,
    message: 'Too many requests. Please wait a few minutes and try again.',
  },
  over_request_rate_limit: {
    code: ErrorCode.RATE_LIMITED,
    message: 'Too many requests. Please wait a few minutes and try again.',
  },
  signup_disabled: {
    code: ErrorCode.FORBIDDEN,
    message: 'Sign-ups are currently disabled.',
  },
  email_address_invalid: {
    code: ErrorCode.VALIDATION_ERROR,
    message: 'Please enter a valid email address.',
  },
  email_address_not_authorized: {
    code: ErrorCode.FORBIDDEN,
    message: 'This email address is not allowed to sign up.',
  },
  bad_jwt: {
    code: ErrorCode.UNAUTHORIZED,
    message: 'Your session has expired. Please sign in again.',
  },
  session_not_found: {
    code: ErrorCode.UNAUTHORIZED,
    message: 'Your session has expired. Please sign in again.',
  },
  validation_failed: {
    code: ErrorCode.VALIDATION_ERROR,
    message: 'Please check the form for errors and try again.',
  },
  same_password: {
    code: ErrorCode.VALIDATION_ERROR,
    message: 'New password must be different from the current one.',
  },
  user_not_found: {
    code: ErrorCode.NOT_FOUND,
    message: 'No account found with that email.',
  },
};

const GENERIC_AUTH_ERROR: AuthErrorMapping = {
  code: ErrorCode.INTERNAL_ERROR,
  message: 'Something went wrong. Please try again.',
};

export function mapSupabaseAuthError(err: AuthError | Error | null | undefined): AppError {
  if (!err) {
    return new AppError({
      code: GENERIC_AUTH_ERROR.code,
      message: GENERIC_AUTH_ERROR.message,
    });
  }

  const code = (err as AuthError).code;
  const mapped = code ? AUTH_ERROR_MAP[code] : undefined;
  const target = mapped ?? GENERIC_AUTH_ERROR;

  return new AppError({
    code: target.code,
    message: target.message,
    cause: err,
    metadata: code ? { supabaseCode: code } : {},
  });
}

/** Test-only: expose the map for assertion of supported codes. */
export const __AUTH_ERROR_CODES_FOR_TESTS = Object.keys(AUTH_ERROR_MAP);
