import { AppError, ErrorCode } from '@magic-prompt/shared';
import { createBrowserClient } from '@supabase/ssr';

// Read NEXT_PUBLIC_* env vars directly from `process.env`. Next inlines these
// at build time, so they're available in the browser. We deliberately do NOT
// import `@/lib/env` here — that module runs Zod validation over the full
// env schema (including the server-only, strict `OPENAI_API_KEY`), which
// would crash on hydration. The Phase 3 deviation list documents this fence.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export function createClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new AppError({
      code: ErrorCode.INTERNAL_ERROR,
      message:
        'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.',
    });
  }
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
