'use server';

import { ErrorCode } from '@magic-prompt/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { type AuthActionState, authLogger, fieldErrorState, getClientIp } from './_shared';

import { mapSupabaseAuthError } from '@/features/auth/lib/errors';
import { RateLimits, checkRateLimit } from '@/features/auth/lib/rate-limit';
import { SignupSchema } from '@/features/auth/lib/validation';
import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

const log = authLogger.child({ action: 'signup' });

export async function signupAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = SignupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    acceptedTos: formData.get('acceptedTos') === 'on' || formData.get('acceptedTos') === 'true',
  });

  if (!parsed.success) {
    return fieldErrorState(parsed, 'Please fix the errors below.');
  }

  const ip = getClientIp();
  const rateKey = `${ip}:${parsed.data.email}`;
  const rl = checkRateLimit('signup', rateKey, RateLimits.signup);
  if (!rl.allowed) {
    log.warn({ ip, retryAfter: rl.retryAfterSeconds }, 'rate limit exceeded');
    return {
      status: 'error',
      code: ErrorCode.RATE_LIMITED,
      message: `Too many sign-up attempts. Try again in ${rl.retryAfterSeconds}s.`,
    };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error) {
    const mapped = mapSupabaseAuthError(error);
    log.warn(
      { code: mapped.code, supabaseCode: error.code, email: parsed.data.email },
      'signup failed',
    );
    return { status: 'error', code: mapped.code, message: mapped.message };
  }

  log.info({ email: parsed.data.email }, 'signup succeeded — verification email sent');
  revalidatePath('/', 'layout');
  redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
}
