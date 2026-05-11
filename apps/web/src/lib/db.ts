import 'server-only';

import { createDatabaseClient, type Database, type DatabaseHandle } from '@magic-prompt/database';
import { AppError, ErrorCode } from '@magic-prompt/shared';

import { env, isDatabaseConfigured } from './env';

/**
 * Process-wide Drizzle handle. Reuses a single postgres-js connection pool
 * across server actions / route handlers — `postgres-js` is designed for this
 * pattern (it lazily-connects, multiplexes via the pool, and is idempotent
 * across HMR reloads in dev as long as we cache on `globalThis`).
 *
 * Drizzle bypasses RLS (the connection uses the `postgres` role which has
 * BYPASSRLS). Every callsite **MUST** filter mutations by `userId` against
 * the value returned from `requireUser()`. Reads should use the Supabase JS
 * client instead, where RLS is enforced via JWT.
 */
const GLOBAL_KEY = '__magicprompt_db__';

type GlobalWithDb = typeof globalThis & {
  [GLOBAL_KEY]?: DatabaseHandle;
};

export function getDb(): Database {
  if (!isDatabaseConfigured || !env.DATABASE_URL) {
    throw new AppError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Database is not configured. Set DATABASE_URL in apps/web/.env.local.',
    });
  }
  const g = globalThis as GlobalWithDb;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = createDatabaseClient({
      connectionString: env.DATABASE_URL,
      max: 10,
    });
  }
  return g[GLOBAL_KEY]!.db;
}
