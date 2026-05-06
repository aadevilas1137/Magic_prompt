import 'server-only';

import type { Session } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';

/**
 * Returns the current session **without** validating its JWT against
 * Supabase Auth. **Do not use this for authorization decisions** — use
 * `getUser()` from `./get-user` instead.
 *
 * Use cases for this helper:
 *  - Cheap "is the user logged in at all?" probe in middleware (where we
 *    already trust the cookie because middleware refreshes it).
 *  - Reading session metadata like provider tokens for OAuth flows.
 */
export async function getSession(): Promise<Session | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}
