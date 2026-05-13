/* eslint-disable no-console */
/**
 * Verify Phase 3 chat schema changes are live in Supabase.
 *
 * Checks (in order):
 *   1. New columns exist on `chats` (summary, last_message_at, is_archived, model).
 *   2. New columns exist on `messages` (token_count, model, error,
 *      parent_message_id, latency_ms).
 *   3. Indexes are present (idx_chats_user_last_message, idx_messages_parent).
 *   4. Trigger `on_message_inserted` is installed on `messages`.
 *   5. RLS still blocks anon access on both tables.
 *
 * Connects via the service role (server-side schema introspection requires
 * elevated privileges — anon can't read information_schema views). RLS
 * verification re-runs with the anon key.
 *
 * Usage:
 *   pnpm tsx tooling/scripts/verify-chat-schema.ts
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import postgres from 'postgres';

const ENV_PATH = path.resolve(process.cwd(), 'apps/web/.env.local');

if (!existsSync(ENV_PATH)) {
  console.error(`[verify-chat-schema] missing ${ENV_PATH}`);
  process.exit(1);
}

interface Config {
  readonly url: string;
  readonly anonKey: string;
  readonly dbUrl: string;
}

function loadConfig(): Config {
  const env = parseDotenv(readFileSync(ENV_PATH, 'utf8'));
  const url = env['NEXT_PUBLIC_SUPABASE_URL'];
  const anonKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  const dbUrl = env['MIGRATE_DATABASE_URL'] ?? env['DATABASE_URL'];

  if (!url || !anonKey) {
    console.error('[verify-chat-schema] supabase URL or anon key missing in .env.local');
    process.exit(1);
  }
  if (!dbUrl) {
    console.error('[verify-chat-schema] MIGRATE_DATABASE_URL / DATABASE_URL missing in .env.local');
    process.exit(1);
  }
  return { url, anonKey, dbUrl };
}

interface ExpectedColumn {
  readonly table: 'chats' | 'messages';
  readonly column: string;
  readonly type: string;
}

const EXPECTED_COLUMNS: readonly ExpectedColumn[] = [
  { table: 'chats', column: 'summary', type: 'text' },
  { table: 'chats', column: 'last_message_at', type: 'timestamp with time zone' },
  { table: 'chats', column: 'is_archived', type: 'boolean' },
  { table: 'chats', column: 'model', type: 'character varying' },
  { table: 'messages', column: 'token_count', type: 'integer' },
  { table: 'messages', column: 'model', type: 'character varying' },
  { table: 'messages', column: 'error', type: 'text' },
  { table: 'messages', column: 'parent_message_id', type: 'uuid' },
  { table: 'messages', column: 'latency_ms', type: 'integer' },
];

const EXPECTED_INDEXES = ['idx_chats_user_last_message', 'idx_messages_parent'];

async function main(): Promise<void> {
  const { url, anonKey, dbUrl } = loadConfig();
  const sql = postgres(dbUrl, { prepare: false, max: 1 });
  let failures = 0;

  try {
    console.log('[verify-chat-schema] checking columns…');
    for (const expected of EXPECTED_COLUMNS) {
      const rows = await sql<Array<{ data_type: string }>>`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ${expected.table}
          AND column_name = ${expected.column}
      `;
      const present = rows.length === 1;
      const typeMatch = present && rows[0]!.data_type === expected.type;
      const ok = present && typeMatch;
      const symbol = ok ? '✓' : '✗';
      console.log(
        `  ${symbol} ${expected.table}.${expected.column} (${expected.type})${
          ok ? '' : ` — found: ${present ? rows[0]!.data_type : 'MISSING'}`
        }`,
      );
      if (!ok) failures += 1;
    }

    console.log('\n[verify-chat-schema] checking indexes…');
    for (const idxName of EXPECTED_INDEXES) {
      const rows = await sql<Array<{ indexname: string }>>`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = ${idxName}
      `;
      const ok = rows.length === 1;
      console.log(`  ${ok ? '✓' : '✗'} ${idxName}${ok ? '' : ' — MISSING'}`);
      if (!ok) failures += 1;
    }

    console.log('\n[verify-chat-schema] checking trigger on_message_inserted…');
    const triggers = await sql<Array<{ tgname: string }>>`
      SELECT tgname FROM pg_trigger
      WHERE NOT tgisinternal
        AND tgname = 'on_message_inserted'
    `;
    const triggerOk = triggers.length === 1;
    console.log(`  ${triggerOk ? '✓' : '✗'} on_message_inserted${triggerOk ? '' : ' — MISSING'}`);
    if (!triggerOk) failures += 1;
  } finally {
    await sql.end();
  }

  console.log('\n[verify-chat-schema] re-checking RLS via anon client…');
  const supa = createClient(url, anonKey, { auth: { persistSession: false } });
  for (const table of ['chats', 'messages'] as const) {
    const { data, error } = await supa.from(table).select('id').limit(1);
    const safe = error !== null || (data?.length ?? 0) === 0;
    console.log(`  ${safe ? '✓' : '✗ LEAK'} anon SELECT ${table} → rows=${data?.length ?? 0}`);
    if (!safe) failures += 1;
  }

  if (failures > 0) {
    console.error(`\n[verify-chat-schema] FAIL — ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('\n[verify-chat-schema] OK — all chat schema enhancements live + RLS intact');
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
  console.error('[verify-chat-schema] uncaught error:', err);
  process.exit(1);
});
