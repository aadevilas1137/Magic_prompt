import { updateSession } from './lib/supabase/middleware';

import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // TODO(phase-2): compose next-intl middleware here once `hi` locale ships.
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (Next assets)
     * - favicon and common image extensions
     * - /api routes (handled in route handlers themselves)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
