import 'server-only';

import { redirect } from 'next/navigation';

import { getUser } from './get-user';

import type { User } from '@supabase/supabase-js';

/**
 * Server-component / route-handler helper that throws a Next.js `redirect`
 * to `/login?redirect=<currentPath>` when there's no authenticated user.
 *
 * Defense-in-depth: middleware also redirects unauthenticated users away
 * from protected routes. This helper is the second line of defense for
 * cases where middleware is bypassed (e.g. direct route-handler access
 * during E2E or programmatic invocation in tests).
 *
 * The optional `currentPath` argument lets the caller provide the path the
 * user was trying to reach so the redirect query param is accurate. If
 * omitted, defaults to `/chat` (the canonical post-login landing).
 */
export async function requireUser(currentPath?: string): Promise<User> {
  const user = await getUser();
  if (!user) {
    const target = currentPath ?? '/chat';
    redirect(`/login?redirect=${encodeURIComponent(target)}`);
  }
  return user;
}
