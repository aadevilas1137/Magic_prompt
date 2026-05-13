import * as schema from '@magic-prompt/database/schema';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';

import { ipeLogger } from './logger';

/**
 * Service-role DB client for `prompt_logs` writes.
 *
 * Why this exists separately from `apps/web/src/lib/db.ts`:
 *
 *   The chat-side Drizzle client (apps/web) connects through the Supabase
 *   **transaction pooler** — fine for short-lived ephemeral queries but
 *   uses the project's `postgres` role with default privileges. RLS on
 *   `prompt_logs` is a `RESTRICTIVE` deny-all policy that even bypasses
 *   `BYPASSRLS` roles. To write `prompt_logs`, we MUST use a connection
 *   string that authenticates as a role exempt from the deny-all OR
 *   use the Supabase service-role API key over PostgREST.
 *
 *   We use the Postgres connection (Drizzle native) for these reasons:
 *     1. Atomic upserts + complex selects without round-tripping through PostgREST.
 *     2. Re-uses the same Drizzle schema types we use elsewhere.
 *     3. Avoids exposing service-role over HTTPS request paths.
 *
 *   The connection is the same DATABASE_URL used by the chat path; what
 *   makes it "service-role" is just that the IPE pipeline runs in a
 *   server-only context (`'server-only'` import) and is exempt from RLS
 *   because Drizzle bypasses PostgREST entirely.
 *
 *   In Phase 8 we'll lift this into a dedicated `service_role` Postgres
 *   role with explicit grants; for now the practical security boundary
 *   is "this module is only imported from server code".
 */
export type ServiceRoleDb = PostgresJsDatabase<typeof schema>;

interface ServiceRoleHandle {
  readonly db: ServiceRoleDb;
  readonly sql: Sql;
  close(): Promise<void>;
}

const GLOBAL_KEY = '__magicprompt_ipe_service_role_db__';

type GlobalWithDb = typeof globalThis & {
  [GLOBAL_KEY]?: ServiceRoleHandle;
};

export interface CreateServiceRoleDbOptions {
  readonly connectionString: string;
  readonly max?: number;
}

export function getServiceRoleDb(opts: CreateServiceRoleDbOptions): ServiceRoleDb {
  const g = globalThis as GlobalWithDb;
  if (!g[GLOBAL_KEY]) {
    const sql = postgres(opts.connectionString, {
      max: opts.max ?? 4,
      idle_timeout: 20,
    });
    const db = drizzle(sql, { schema });
    g[GLOBAL_KEY] = {
      db,
      sql,
      close: async () => {
        await sql.end({ timeout: 5 });
      },
    };
    ipeLogger.info({ poolMax: opts.max ?? 4 }, 'service-role DB pool initialised');
  }
  return g[GLOBAL_KEY]!.db;
}

/** Test seam — clears the cached singleton so a fresh handle is built next call. */
export async function __closeServiceRoleDbForTests(): Promise<void> {
  const g = globalThis as GlobalWithDb;
  const handle = g[GLOBAL_KEY];
  if (handle) {
    await handle.close();
    delete g[GLOBAL_KEY];
  }
}
