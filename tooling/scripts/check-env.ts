/* eslint-disable no-console */
/**
 * Validates `apps/web/.env.local` against the documented contract.
 * Run via `pnpm check-env`.
 *
 * Self-contained: parses the .env file with no runtime dependencies, so it
 * works before `pnpm install` has finished too.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ENV_PATH = path.resolve(process.cwd(), 'apps/web/.env.local');

const REQUIRED: readonly string[] = ['NEXT_PUBLIC_APP_URL'];

const OPTIONAL: readonly string[] = [
  'NODE_ENV',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'OPENAI_API_KEY',
  'NEXT_PUBLIC_SENTRY_DSN',
  'SENTRY_AUTH_TOKEN',
  'NEXT_PUBLIC_POSTHOG_KEY',
  'NEXT_PUBLIC_POSTHOG_HOST',
  'LOG_LEVEL',
];

if (!existsSync(ENV_PATH)) {
  console.error(`[check-env] Missing ${ENV_PATH}.`);
  console.error('           Copy apps/web/.env.example to apps/web/.env.local and try again.');
  process.exit(1);
}

const file = readFileSync(ENV_PATH, 'utf8');
const seen = new Map<string, string>();

for (const rawLine of file.split('\n')) {
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
  if (value.length > 0) seen.set(key, value);
}

const missing = REQUIRED.filter((k) => !seen.has(k));
if (missing.length > 0) {
  console.error(`[check-env] Missing required: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('[check-env] OK');
console.log(
  JSON.stringify(
    {
      required: Object.fromEntries(REQUIRED.map((k) => [k, seen.has(k) ? 'set' : 'MISSING'])),
      optional: Object.fromEntries(OPTIONAL.map((k) => [k, seen.has(k) ? 'set' : 'unset'])),
    },
    null,
    2,
  ),
);
