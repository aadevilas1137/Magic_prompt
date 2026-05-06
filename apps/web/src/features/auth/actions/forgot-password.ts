'use server';

import { ErrorCode } from '@magic-prompt/shared';

import { type AuthActionState, authLogger, fieldErrorState, getClientIp } from './_shared';

import { mapSupabaseAuthError } from '@/features/auth/lib/errors';
import { RateLimits, checkRateLimit } from '@/features/auth/lib/rate-limit';
import { ForgotPasswordSchema } from '@/features/auth/lib/validation';
import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

const log = authLogger.child({ action: 'forgot-password' });

const GENERIC_SUCCESS = {
  status: 'success' as const,
  message: 'If an account exists for that email, a reset link has been sent.',
};

export async function forgotPasswordAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = ForgotPasswordSchema.safeParse({ email: formData.get('email') });

  if (!parsed.success) {
    return fieldErrorState(parsed, 'Enter a valid email address.');
  }

  const ip = getClientIp();
  const rateKey = `${ip}:${parsed.data.email}`;
  const rl = checkRateLimit('forgotPassword', rateKey, RateLimits.forgotPassword);
  if (!rl.allowed) {
    log.warn({ ip, retryAfter: rl.retryAfterSeconds }, 'rate limit exceeded');
    return {
      status: 'error',
      code: ErrorCode.RATE_LIMITED,
      message: `Too many requests. Try again in ${rl.retryAfterSeconds}s.`,
    };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.NEXT_PUBLIC_APP_URL}/reset-password`,
  });

  // Deliberate: we always return the same generic success message so attackers
  // can't enumerate which emails have accounts. Failure is logged server-side.
  if (error) {
    const mapped = mapSupabaseAuthError(error);
    log.warn(
      { code: mapped.code, supabaseCode: error.code, email: parsed.data.email },
      'forgot-password call failed (returning generic success to avoid enumeration)',
    );
    // Still return the generic success — UNLESS the failure is a rate limit
    // from the upstream (Supabase's own throttling) which we DO surface.
    if (mapped.code === ErrorCode.RATE_LIMITED) {
      return { status: 'error', code: mapped.code, message: mapped.message };
    }
    return GENERIC_SUCCESS;
  }

  log.info({ email: parsed.data.email }, 'password reset email queued');
  return GENERIC_SUCCESS;
}
