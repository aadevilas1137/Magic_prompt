# `@magic-prompt/database`

Drizzle ORM schema + client for the Supabase Postgres database.

## Tables

| Table         | Purpose                                                | Public API? |
| ------------- | ------------------------------------------------------ | ----------- |
| `users`       | App-level users (1:1 with `auth.users`)                | Yes         |
| `chats`       | A user's chat conversations                            | Yes         |
| `messages`    | Messages within a chat (`role`: system/user/assistant) | Yes         |
| `prompt_logs` | **INTERNAL** — IPE telemetry. Never exposed publicly.  | No          |

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
