'use server';

import { ErrorCode } from '@magic-prompt/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { type AuthActionState, authLogger, fieldErrorState, getClientIp } from './_shared';

import {
  anonDistinctId,
  compactProperties,
  getEmailDomain,
  trackAuthEvent,
} from '@/features/auth/lib/analytics';
import { mapSupabaseAuthError } from '@/features/auth/lib/errors';
import { RateLimits, checkRateLimit } from '@/features/auth/lib/rate-limit';
import { SAFE_REDIRECT_DEFAULT, safeRedirect } from '@/features/auth/lib/safe-redirect';
import { LoginSchema } from '@/features/auth/lib/validation';
import { createClient } from '@/lib/supabase/server';

const log = authLogger.child({ action: 'login' });

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return fieldErrorState(parsed, 'Enter a valid email and password.');
  }

  const ip = getClientIp();
  const emailDomain = getEmailDomain(parsed.data.email);
  trackAuthEvent({
    distinctId: anonDistinctId(ip),
    event: 'auth.login.attempted',
    properties: compactProperties({ emailDomain, ip }),
  });

  const rateKey = `${ip}:${parsed.data.email}`;
  const rl = checkRateLimit('login', rateKey, RateLimits.login);
  if (!rl.allowed) {
    log.warn({ ip, retryAfter: rl.retryAfterSeconds }, 'rate limit exceeded');
    trackAuthEvent({
      distinctId: anonDistinctId(ip),
      event: 'auth.login.failed',
      properties: compactProperties({
        errorCode: ErrorCode.RATE_LIMITED,
        emailDomain,
        ip,
      }),
    });
    return {
      status: 'error',
      code: ErrorCode.RATE_LIMITED,
      message: `Too many attempts. Try again in ${rl.retryAfterSeconds}s.`,
    };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    const mapped = mapSupabaseAuthError(error);
    log.warn(
      { code: mapped.code, supabaseCode: error.code, email: parsed.data.email },
      'login failed',
    );
    trackAuthEvent({
      distinctId: anonDistinctId(ip),
      event: 'auth.login.failed',
      properties: compactProperties({ errorCode: mapped.code, emailDomain, ip }),
    });
    return { status: 'error', code: mapped.code, message: mapped.message };
  }

  log.info({ email: parsed.data.email }, 'login succeeded');

  const userId = data?.user?.id;
  trackAuthEvent({
    distinctId: userId ?? anonDistinctId(ip),
    event: 'auth.login.succeeded',
    properties: compactProperties({ userId, emailDomain }),
  });

  const redirectTarget = safeRedirect(formData.get('redirect') as string | null);
  revalidatePath('/', 'layout');
  redirect(redirectTarget || SAFE_REDIRECT_DEFAULT);
}
