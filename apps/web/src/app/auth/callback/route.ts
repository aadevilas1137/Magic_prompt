import { createLogger } from '@magic-prompt/logger';
import { NextResponse, type NextRequest } from 'next/server';

import { safeRedirect } from '@/features/auth/lib/safe-redirect';
import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const log = createLogger('auth:callback');

/**
 * OAuth callback — Supabase redirects here after a successful provider
 * authentication with a `?code=` query param. We exchange that code for
 * a session (which sets the auth cookies via `@supabase/ssr`) and then
 * redirect the user to wherever they were trying to go.
 *
 * **Path:** `/auth/callback` — deliberately NOT inside the `(auth)` route
 * group so the URL is stable and Supabase's allowed-redirect-URLs config
 * matches a single path. Locale prefix is intentionally skipped in the
 * middleware matcher (Phase 2 step 9) so OAuth providers only need one URL.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeRedirect(url.searchParams.get('redirect'));
  const errorParam = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  if (errorParam) {
    log.warn({ errorParam, errorDescription }, 'OAuth provider returned an error');
    const dest = new URL('/login', env.NEXT_PUBLIC_APP_URL);
    dest.searchParams.set('error', 'oauth_failed');
    return NextResponse.redirect(dest);
  }

  if (!code) {
    log.warn({}, 'callback hit without a code');
    return NextResponse.redirect(new URL('/login', env.NEXT_PUBLIC_APP_URL));
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    log.warn({ supabaseCode: error.code }, 'failed to exchange OAuth code');
    const dest = new URL('/login', env.NEXT_PUBLIC_APP_URL);
    dest.searchParams.set('error', 'oauth_failed');
    return NextResponse.redirect(dest);
  }

  log.info({}, 'OAuth code exchanged — session established');
  return NextResponse.redirect(new URL(next, env.NEXT_PUBLIC_APP_URL));
}
