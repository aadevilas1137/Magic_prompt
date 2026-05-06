import 'server-only';

import type { User } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';

/**
 * Returns the authenticated Supabase user for the current request, or `null`
 * if there's no session.
 *
 * Always uses `auth.getUser()` (which validates the JWT against Supabase
 * Auth) — never `getSession()`, because that one trusts the cookie blindly
 * and is therefore unsafe for server-side authorization checks.
 *
 * Throws if Supabase isn't configured (the `createClient` factory enforces
 * that). Callers in environments where Supabase is optional should guard
 * with `isSupabaseConfigured` from `@/lib/env` first.
 */
export async function getUser(): Promise<User | null> {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}
