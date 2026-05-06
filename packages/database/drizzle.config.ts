import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit (migrate, generate, push, studio) needs a Postgres connection
 * that supports prepared statements and DDL-in-transactions. The Supabase
 * **transaction pooler** (port 6543) breaks both — it drops session state
 * between statements and rejects multi-statement DDL.
 *
 * So we prefer `MIGRATE_DATABASE_URL`, which is expected to point at the
 * **Session pooler** (port 5432) or **Direct connection** of the same project.
 * Runtime app code (Drizzle queries via `createDatabaseClient`) keeps using
 * `DATABASE_URL`, which is allowed to be the cheaper transaction pooler.
 *
 * The fallback to `DATABASE_URL` is intentional: in environments where only
 * one URL is configured (e.g. local dev pointing at a direct connection),
 * drizzle-kit still works without extra wiring.
 */
const connectionString = process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    '[@magic-prompt/database] MIGRATE_DATABASE_URL or DATABASE_URL must be set for drizzle-kit. ' +
      'Set MIGRATE_DATABASE_URL to the Session pooler / Direct connection string (port 5432) ' +
      'before running db:generate / db:migrate.',
  );
}

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: { url: connectionString },
  strict: true,
  verbose: true,
});
