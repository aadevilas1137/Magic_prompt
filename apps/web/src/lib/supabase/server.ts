import { AppError, ErrorCode } from '@magic-prompt/shared';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { env, isSupabaseConfigured } from '../env';

interface CookieToSet {
  readonly name: string;
  readonly value: string;
  readonly options: CookieOptions;
}

export function createClient() {
  if (!isSupabaseConfigured) {
    throw new AppError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Supabase is not configured.',
    });
  }
  const cookieStore = cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL as string,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — Next.js prevents writes here.
            // The middleware refreshes session cookies, so this is safe.
          }
        },
      },
    },
  );
}
