# `@magic-prompt/database`

Drizzle ORM schema + client for the Supabase Postgres database.

## Tables

| Table         | Purpose                                                | Public API? |
| ------------- | ------------------------------------------------------ | ----------- |
| `users`       | App-level users (1:1 with `auth.users`)                | Yes         |
| `chats`       | A user's chat conversations                            | Yes         |
| `messages`    | Messages within a chat (`role`: system/user/assistant) | Yes         |
| `prompt_logs` | **INTERNAL** — IPE telemetry. Never exposed publicly.  | No          |

## Local setup

1. Create a Supabase project at https://app.supabase.com.
2. Copy the connection string from **Project Settings → Database → URI** (use the `Transaction` pooler for serverless or `Session` for long-running).
3. Set `DATABASE_URL` in your `.env.local`.
4. Generate migrations:
   ```bash
   pnpm --filter @magic-prompt/database db:generate
   ```
5. Apply them:
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
