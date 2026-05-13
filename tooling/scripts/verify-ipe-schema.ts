/* eslint-disable no-console */
/**
 * Verify Phase 4 IPE schema changes are live in Supabase.
 *
 * Checks (in order):
 *   1. All new Phase 4 columns exist on `prompt_logs` with correct types.
 *   2. Legacy stub columns (`domain`, `complexity`, `llm_used`) are nullable.
 *   3. Legacy `quality_score` is now `integer` (was `real`).
 *   4. All 5 new analytics indexes exist.
 *   5. RLS still blocks anon reads (deny-all RESTRICTIVE policy intact).
 *   6. Service-role can insert + delete a row (write path works).
 *
 * Usage:  pnpm tsx tooling/scripts/verify-ipe-schema.ts
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import postgres from 'postgres';

const ENV_PATH = path.resolve(process.cwd(), 'apps/web/.env.local');

if (!existsSync(ENV_PATH)) {
  console.error(`[verify-ipe-schema] missing ${ENV_PATH}`);
  process.exit(1);
}

interface Config {
  readonly url: string;
  readonly anonKey: string;
  readonly serviceRoleKey: string;
  readonly dbUrl: string;
}

function loadConfig(): Config {
  const env = parseDotenv(readFileSync(ENV_PATH, 'utf8'));
  const url = env['NEXT_PUBLIC_SUPABASE_URL'];
  const anonKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY'];
  const dbUrl = env['MIGRATE_DATABASE_URL'] ?? env['DATABASE_URL'];

  if (!url || !anonKey || !serviceRoleKey) {
    console.error('[verify-ipe-schema] supabase URL / anon key / service role key missing');
    process.exit(1);
  }
  if (!dbUrl) {
    console.error('[verify-ipe-schema] MIGRATE_DATABASE_URL / DATABASE_URL missing');
    process.exit(1);
  }
  return { url, anonKey, serviceRoleKey, dbUrl };
}

interface ExpectedColumn {
  readonly column: string;
  readonly type: string;
  readonly nullable: boolean;
}

const PHASE_4_COLUMNS: readonly ExpectedColumn[] = [
  { column: 'chat_id', type: 'uuid', nullable: true },
  { column: 'message_id', type: 'uuid', nullable: true },
  { column: 'intent_json', type: 'jsonb', nullable: true },
  { column: 'classifier_json', type: 'jsonb', nullable: true },
  { column: 'primary_domain', type: 'character varying', nullable: true },
  { column: 'secondary_domain', type: 'character varying', nullable: true },
  { column: 'complexity_score', type: 'character varying', nullable: true },
  { column: 'layer_latencies_ms', type: 'jsonb', nullable: true },
  { column: 'quality_score', type: 'integer', nullable: true },
  { column: 'quality_method', type: 'character varying', nullable: true },
  { column: 'fallback_used', type: 'boolean', nullable: false },
  { column: 'error', type: 'text', nullable: true },
  { column: 'pipeline_version', type: 'character varying', nullable: false },
];

const NOW_NULLABLE_LEGACY = ['domain', 'complexity', 'llm_used'];
const EXPECTED_INDEXES = [
  'idx_prompt_logs_user_created',
  'idx_prompt_logs_domain',
  'idx_prompt_logs_complexity',
  'idx_prompt_logs_quality',
  'idx_prompt_logs_fallback',
];

async function main(): Promise<void> {
  const { url, anonKey, serviceRoleKey, dbUrl } = loadConfig();
  const sql = postgres(dbUrl, { prepare: false, max: 1 });
  let failures = 0;

  try {
    console.log('[verify-ipe-schema] Phase 4 columns…');
    for (const expected of PHASE_4_COLUMNS) {
      const rows = await sql<Array<{ data_type: string; is_nullable: string }>>`
        SELECT data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'prompt_logs'
          AND column_name = ${expected.column}
      `;
      const present = rows.length === 1;
      const typeMatch = present && rows[0]!.data_type === expected.type;
      const nullableMatch = present && rows[0]!.is_nullable === (expected.nullable ? 'YES' : 'NO');
      const ok = present && typeMatch && nullableMatch;
      const symbol = ok ? '✓' : '✗';
      console.log(
        `  ${symbol} ${expected.column.padEnd(20)} ${expected.type.padEnd(20)} ${expected.nullable ? 'NULL' : 'NOT NULL'}` +
          (ok
            ? ''
            : ` — found: type=${present ? rows[0]!.data_type : 'MISSING'}, nullable=${present ? rows[0]!.is_nullable : 'MISSING'}`),
      );
      if (!ok) failures += 1;
    }

    console.log('\n[verify-ipe-schema] legacy stub columns now nullable…');
    for (const col of NOW_NULLABLE_LEGACY) {
      const rows = await sql<Array<{ is_nullable: string }>>`
        SELECT is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'prompt_logs'
          AND column_name = ${col}
      `;
      const ok = rows.length === 1 && rows[0]!.is_nullable === 'YES';
      console.log(`  ${ok ? '✓' : '✗'} ${col} ${ok ? 'NULL' : '— still NOT NULL'}`);
      if (!ok) failures += 1;
    }

    console.log('\n[verify-ipe-schema] analytics indexes…');
    for (const idxName of EXPECTED_INDEXES) {
      const rows = await sql<Array<{ indexname: string }>>`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = ${idxName}
      `;
      const ok = rows.length === 1;
      console.log(`  ${ok ? '✓' : '✗'} ${idxName}${ok ? '' : ' — MISSING'}`);
      if (!ok) failures += 1;
    }

    console.log('\n[verify-ipe-schema] service-role insert + delete (write path)…');
    const userRows = await sql<Array<{ id: string }>>`SELECT id FROM public.users LIMIT 1`;
    if (userRows.length === 0) {
      console.log(`  ⚠ skipped — no users in DB yet (sign up locally first to test write path)`);
    } else {
      const userId = userRows[0]!.id;
      try {
        const inserted = await sql<Array<{ id: string }>>`
          INSERT INTO public.prompt_logs (
            user_id, original_input, magic_prompt, primary_domain, complexity_score,
            fallback_used, pipeline_version
          ) VALUES (
            ${userId}::uuid,
            'verify-ipe-schema probe',
            'verify-ipe-schema probe prompt',
            'general',
            'simple',
            false,
            'v1'
          )
          RETURNING id
        `;
        const probeId = inserted[0]!.id;
        await sql`DELETE FROM public.prompt_logs WHERE id = ${probeId}::uuid`;
        console.log('  ✓ insert + delete round-trip succeeded');
      } catch (err) {
        console.log(`  ✗ write probe failed: ${(err as Error).message}`);
        failures += 1;
      }
    }
  } finally {
    await sql.end();
  }

  console.log('\n[verify-ipe-schema] RLS deny-all still blocks anon reads…');
  const supa = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await supa.from('prompt_logs').select('id').limit(1);
  const rlsOk = error !== null || (data?.length ?? 0) === 0;
  console.log(
    `  ${rlsOk ? '✓' : '✗ LEAK'} anon SELECT prompt_logs → rows=${data?.length ?? 0}` +
      (error ? `, error=${error.code}` : ''),
  );
  if (!rlsOk) failures += 1;

  console.log('\n[verify-ipe-schema] service-role bypasses RLS (sanity)…');
  const svc = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const svcResult = await svc.from('prompt_logs').select('id').limit(1);
  const svcOk = !svcResult.error;
  console.log(`  ${svcOk ? '✓' : '✗'} service-role SELECT works`);
  if (!svcOk) failures += 1;

  if (failures > 0) {
    console.error(`\n[verify-ipe-schema] FAIL — ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('\n[verify-ipe-schema] OK — Phase 4 IPE schema live + RLS intact');
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
  console.error('[verify-ipe-schema] uncaught error:', err);
  process.exit(1);
});
