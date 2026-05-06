'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { type AuthActionState, authLogger, fieldErrorState } from './_shared';

import { mapSupabaseAuthError } from '@/features/auth/lib/errors';
import { ResetPasswordSchema } from '@/features/auth/lib/validation';
import { createClient } from '@/lib/supabase/server';

const log = authLogger.child({ action: 'reset-password' });

/**
 * Called from the password-reset form **after** the user has clicked the
 * reset link in their email. Supabase verifies the token from the URL hash
 * and creates a recovery session — this action runs while that recovery
 * session is active and updates the user's password.
 */
export async function resetPasswordAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = ResetPasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return fieldErrorState(parsed, 'Please fix the errors below.');
  }

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    const mapped = mapSupabaseAuthError(error);
    log.warn({ code: mapped.code, supabaseCode: error.code }, 'password reset failed');
    return { status: 'error', code: mapped.code, message: mapped.message };
  }

  log.info({}, 'password reset succeeded');
  revalidatePath('/', 'layout');
  redirect('/chat');
}
