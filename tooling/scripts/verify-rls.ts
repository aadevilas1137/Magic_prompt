/* eslint-disable no-console */
/**
 * Verify Row-Level Security is correctly blocking unauthorized access.
 *
 * Connects to Supabase using the **anon key** (which represents an
 * unauthenticated client) and confirms that every public table either
 * returns zero rows or rejects the query, NEVER leaks another user's data.
 *
 * Usage:
 *   pnpm tsx tooling/scripts/verify-rls.ts
 *
 * Reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from
 * `apps/web/.env.local`. Self-contained — uses only `node:fs` + the
 * Supabase JS client.
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ENV_PATH = path.resolve(process.cwd(), 'apps/web/.env.local');

if (!existsSync(ENV_PATH)) {
  console.error(`[verify-rls] missing ${ENV_PATH}`);
  process.exit(1);
}

const env = parseDotenv(readFileSync(ENV_PATH, 'utf8'));
const url = env['NEXT_PUBLIC_SUPABASE_URL'];
const anonKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

if (!url || !anonKey) {
  console.error('[verify-rls] NEXT_PUBLIC_SUPABASE_URL or anon key missing in .env.local');
  process.exit(1);
}

const supabase = createClient(url, anonKey, { auth: { persistSession: false } });

interface TableExpectation {
  readonly table: 'users' | 'chats' | 'messages' | 'prompt_logs';
  readonly description: string;
}

const TABLES: readonly TableExpectation[] = [
  {
    table: 'users',
    description: 'Anon SELECT must return 0 rows (no row matches auth.uid() = id when uid is null)',
  },
  {
    table: 'chats',
    description: 'Anon SELECT must return 0 rows (RLS scopes to auth.uid())',
  },
  {
    table: 'messages',
    description: 'Anon SELECT must return 0 rows (RLS via chats join scopes to owner)',
  },
  {
    table: 'prompt_logs',
    description: 'Anon SELECT must be blocked by deny-all RESTRICTIVE policy',
  },
];

async function main(): Promise<void> {
  console.log('[verify-rls] testing as anon (unauthenticated) client');
  console.log('[verify-rls] each query should return either 0 rows or an explicit RLS denial\n');

  let failures = 0;
  for (const { table, description } of TABLES) {
    const { data, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: false })
      .limit(5);

    const dataLength = data?.length ?? 0;
    const safe = error || dataLength === 0;
    const symbol = safe ? '✓' : '✗ LEAK';
    if (!safe) failures += 1;

    console.log(`  ${symbol} ${table.padEnd(12)} rows=${dataLength}, count=${count ?? 'n/a'}`);
    console.log(`    ${description}`);
    if (error) console.log(`    error: ${error.message}`);
    console.log('');
  }

  if (failures > 0) {
    console.error(`[verify-rls] FAIL — ${failures} table(s) leaked data to anon client`);
    process.exit(1);
  }
  console.log('[verify-rls] OK — RLS blocks anonymous access on all 4 tables');
}

function parseDotenv(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value.length > 0) out[key] = value;
  }
  return out;
}

main().catch((err) => {
  console.error('[verify-rls] uncaught error:', err);
  process.exit(1);
});
