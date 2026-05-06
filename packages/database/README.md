# `@magic-prompt/database`

Drizzle ORM schema + client for the Supabase Postgres database.

## Tables

| Table         | Purpose                                                       | Public API? | RLS                                                                       |
| ------------- | ------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------- |
| `users`       | App-level users (1:1 with `auth.users`, populated by trigger) | Yes         | self-only SELECT/UPDATE; no INSERT policy (trigger uses SECURITY DEFINER) |
| `chats`       | A user's chat conversations                                   | Yes         | full CRUD scoped to `auth.uid() = user_id`                                |
| `messages`    | Messages within a chat (`role`: system/user/assistant)        | Yes         | SELECT/INSERT/DELETE via chat-ownership join; UPDATE denied (immutable)   |
| `prompt_logs` | **INTERNAL** — IPE telemetry. Never exposed publicly.         | No          | `RESTRICTIVE` deny-all; service-role bypasses RLS                         |

## Auth trigger + RLS (Phase 2)

A second migration (`migrations/0001_auth_trigger_and_rls.sql`) was hand-written to add:

- **`public.handle_new_user()` function + `on_auth_user_created` trigger** — every row inserted into `auth.users` (Supabase auth schema) auto-creates a matching `public.users` row with the same `id` and `email`. The function runs as `SECURITY DEFINER` so it can bypass the RLS that prevents direct client inserts.
- **`ENABLE` + `FORCE ROW LEVEL SECURITY`** on all 4 public tables.
- **10 policies total** — see [`ADR-0007`](../../docs/architecture/ADR/0007-rls-policy-design.md) for the full per-table breakdown.

Drizzle-kit doesn't generate triggers/RLS, so the SQL is hand-rolled. Idempotent (`CREATE OR REPLACE`, `DROP POLICY IF EXISTS`) so re-running is safe.

**Verify RLS is working** any time:

```bash
pnpm tsx tooling/scripts/verify-rls.ts
```

It connects with the anon key and confirms every table returns 0 rows. Exit code 1 if any table leaks data — wire into CI to catch regressions.

## Two-URL pattern (`DATABASE_URL` vs `MIGRATE_DATABASE_URL`)

This package uses **two separate Postgres connection strings**, each tuned for a different lifecycle. **Configure both in `apps/web/.env.local`.**

| Env var                | Used by                                                                                    | Recommended Supabase endpoint                                                                      | Why                                                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`         | App runtime (server components, route handlers, server actions via `createDatabaseClient`) | **Transaction pooler** — `aws-…pooler.supabase.com:6543`                                           | Best for serverless / Next.js — multiplexes many short-lived connections cheaply.                                                                                                |
| `MIGRATE_DATABASE_URL` | `drizzle-kit` only (`db:generate`, `db:migrate`, `db:push`, `db:studio`)                   | **Session pooler** _or_ **Direct connection** — `…supabase.com:5432` / `db.<ref>.supabase.co:5432` | Drizzle migrations use prepared statements and DDL-in-transactions. The transaction pooler drops session state between statements and breaks both, so migrations need port 5432. |

`drizzle.config.ts` reads `MIGRATE_DATABASE_URL` first and falls back to `DATABASE_URL` if not set — so single-URL setups (e.g. local dev with a direct connection only) still work.

## Local setup

1. Create a Supabase project at https://app.supabase.com.
2. From **Project Settings → Database → Connection string** (newer UI: **Connect → ORMs**):
   - Copy the **Transaction pooler** URI (port 6543) → set as `DATABASE_URL` in `apps/web/.env.local`.
   - Copy the **Session pooler** _or_ **Direct connection** URI (port 5432) → set as `MIGRATE_DATABASE_URL` in the same file.
3. Generate migrations:
   ```bash
   pnpm --filter @magic-prompt/database db:generate
   ```
4. Apply them:
   ```bash
   pnpm --filter @magic-prompt/database db:migrate
   ```

## Scripts

| Script        | Purpose                                     |
| ------------- | ------------------------------------------- |
| `db:generate` | Generate SQL migrations from the schema     |
| `db:migrate`  | Apply migrations to the configured database |
| `db:push`     | Push the schema directly (dev only)         |
| `db:studio`   | Launch Drizzle Studio                       |

## Usage

```ts
import { createDatabaseClient } from '@magic-prompt/database';

const { db, close } = createDatabaseClient({
  connectionString: process.env.DATABASE_URL!,
  ssl: 'require',
});
```

`db` is fully typed against the schema. Always `await close()` on shutdown.
