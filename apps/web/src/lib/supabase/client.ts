import { AppError, ErrorCode } from '@magic-prompt/shared';
import { createBrowserClient } from '@supabase/ssr';

import { env, isSupabaseConfigured } from '../env';

export function createClient() {
  if (!isSupabaseConfigured) {
    throw new AppError({
      code: ErrorCode.INTERNAL_ERROR,
      message:
        'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.',
    });
  }
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL as string,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  );
}
