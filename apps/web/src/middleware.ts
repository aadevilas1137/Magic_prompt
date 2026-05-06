import { createLogger } from '@magic-prompt/logger';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing';
import { env, isSupabaseConfigured } from './lib/env';

const log = createLogger('middleware');
const intlMiddleware = createIntlMiddleware(routing);

/**
 * Routes that require an authenticated user. Match against the locale-stripped
 * pathname (so both `/chat` and `/hi/chat` are protected with one rule).
 */
const PROTECTED_PREFIXES = ['/chat'] as const;

const AUTH_ONLY_PREFIXES = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
] as const;

interface CookieToSet {
  readonly name: string;
  readonly value: string;
  readonly options: CookieOptions;
}

/** Strip the locale prefix from `pathname` for matcher comparisons. */
function stripLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return '/';
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
  }
  return pathname;
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAuthOnlyPath(pathname: string): boolean {
  return AUTH_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // OAuth callback never gets locale-prefixed and isn't auth-gated.
  if (pathname.startsWith('/auth/callback')) {
    return NextResponse.next({ request });
  }

  if (!isSupabaseConfigured) {
    // No auth gating if Supabase isn't configured — but still apply locale
    // routing so the i18n DoD holds even in degraded environments.
    return intlMiddleware(request);
  }

  const stripped = stripLocale(pathname);

  // Refresh Supabase session and read the user. Cookies that the supabase
  // client decides to set get attached to the response we hand back.
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL as string,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Auth gating runs against locale-stripped path so one rule covers both
  // /chat and /hi/chat.
  if (isProtectedPath(stripped) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname + request.nextUrl.search);
    log.debug({ pathname }, 'redirecting unauthenticated user to /login');
    return NextResponse.redirect(url);
  }

  if (isAuthOnlyPath(stripped) && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/chat';
    url.search = '';
    log.debug({ pathname, userId: user.id }, 'redirecting authenticated user to /chat');
    return NextResponse.redirect(url);
  }

  // Now hand off to the next-intl middleware so it can apply the locale
  // prefix routing. We pass our cookie-augmented `request` so the cookies
  // are visible to the intl middleware too. The intl response wins (it may
  // rewrite/redirect for locale handling), but our auth cookies still ride
  // along because cookies are part of the request.
  const intlResponse = intlMiddleware(request);

  // Carry over any auth-cookie writes from the supabase client onto the
  // intl response. Without this, the refreshed session cookie would be lost
  // when intlMiddleware constructs its own response object.
  for (const cookie of response.cookies.getAll()) {
    intlResponse.cookies.set(cookie);
  }

  return intlResponse;
}

export const config = {
  matcher: [
    /*
     * Match everything except:
     *   - _next/static, _next/image (Next assets)
     *   - favicon and image extensions
     *   - /api routes
     *   - /auth/callback (handled by its route handler)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
