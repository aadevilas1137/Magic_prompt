'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { authLogger } from './_shared';

import { trackAuthEvent } from '@/features/auth/lib/analytics';
import { createClient } from '@/lib/supabase/server';

const log = authLogger.child({ action: 'logout' });

/**
 * Logout doesn't take a form payload — wired up via a `<form action={logoutAction}>`
 * with no inputs. Always redirects to `/login` on success or failure (the
 * cookie is cleared either way).
 */
export async function logoutAction(): Promise<void> {
  const supabase = createClient();

  // Capture userId BEFORE signOut so we can include it on the analytics event.
  // Wrapped: a failing getUser() must never block logout.
  let userId: string | undefined;
  try {
    const result = await supabase.auth.getUser();
    userId = result?.data?.user?.id;
  } catch {
    userId = undefined;
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    log.warn({ supabaseCode: error.code }, 'logout failed (cookies will still be cleared)');
  } else {
    log.info({}, 'logout succeeded');
  }

  if (userId) {
    trackAuthEvent({
      distinctId: userId,
      event: 'auth.logout',
      properties: { userId },
    });
  }

  revalidatePath('/', 'layout');
  redirect('/login');
}
