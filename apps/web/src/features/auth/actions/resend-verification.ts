'use server';

import { ErrorCode } from '@magic-prompt/shared';

import { type AuthActionState, authLogger, fieldErrorState, getClientIp } from './_shared';

import {
  anonDistinctId,
  compactProperties,
  getEmailDomain,
  trackAuthEvent,
} from '@/features/auth/lib/analytics';
import { mapSupabaseAuthError } from '@/features/auth/lib/errors';
import { RateLimits, checkRateLimit } from '@/features/auth/lib/rate-limit';
import { ForgotPasswordSchema } from '@/features/auth/lib/validation';
import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

const log = authLogger.child({ action: 'resend-verification' });

export async function resendVerificationAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = ForgotPasswordSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return fieldErrorState(parsed, 'Enter a valid email address.');
  }

  const ip = getClientIp();
  const rateKey = `${ip}:${parsed.data.email}`;
  const rl = checkRateLimit('resendVerification', rateKey, RateLimits.resendVerification);
  if (!rl.allowed) {
    log.warn({ ip, retryAfter: rl.retryAfterSeconds }, 'rate limit exceeded');
    return {
      status: 'error',
      code: ErrorCode.RATE_LIMITED,
      message: `Too many requests. Try again in ${rl.retryAfterSeconds}s.`,
    };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error) {
    const mapped = mapSupabaseAuthError(error);
    log.warn(
      { code: mapped.code, supabaseCode: error.code, email: parsed.data.email },
      'resend-verification failed',
    );
    return { status: 'error', code: mapped.code, message: mapped.message };
  }

  log.info({ email: parsed.data.email }, 'verification email re-queued');
  trackAuthEvent({
    distinctId: anonDistinctId(ip),
    event: 'auth.verify.resent',
    properties: compactProperties({ emailDomain: getEmailDomain(parsed.data.email), ip }),
  });
  return {
    status: 'success',
    message: 'Verification email re-sent. Please check your inbox.',
  };
}
