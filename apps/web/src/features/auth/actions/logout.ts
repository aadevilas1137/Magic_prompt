'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { authLogger } from './_shared';

import { createClient } from '@/lib/supabase/server';

const log = authLogger.child({ action: 'logout' });

/**
 * Logout doesn't take a form payload — wired up via a `<form action={logoutAction}>`
 * with no inputs. Always redirects to `/login` on success or failure (the
 * cookie is cleared either way).
 */
export async function logoutAction(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    log.warn({ supabaseCode: error.code }, 'logout failed (cookies will still be cleared)');
  } else {
    log.info({}, 'logout succeeded');
  }

  revalidatePath('/', 'layout');
  redirect('/login');
}
