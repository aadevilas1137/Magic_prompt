# ADR-0007: Row-Level Security policy design

- **Status:** Accepted
- **Date:** 2026-05-06
- **Phase:** 2

## Context

Magic Prompt AI's data has two visibility tiers:

1. **User-owned** — `users`, `chats`, `messages`. Each row belongs to exactly one user. Other users (or anyone unauthenticated) must never see those rows.
2. **Internal-only** — `prompt_logs`. The IPE pipeline writes raw original-input + magic-prompt + LLM output here for telemetry. **No client should ever read this**, even the user who generated the entry. It's our competitive moat and may contain PII the user typed verbatim.

Supabase exposes the database to clients via PostgREST and the JS client. Without RLS, anyone holding the anon key can read everything. With RLS plus carefully-scoped policies, the database itself enforces these visibility tiers — defense in depth alongside the middleware + `requireUser()` checks in the app.

## Decision

Enable RLS (and force RLS) on all four tables. Then add policies as follows.

### `public.users`

| Op       | Allowed when                           | Why                                                                                                                                 |
| -------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `SELECT` | `auth.uid() = id`                      | A user reads only their own profile row.                                                                                            |
| `UPDATE` | `auth.uid() = id` (USING + WITH CHECK) | A user can only update themselves.                                                                                                  |
| `INSERT` | (no policy)                            | The `handle_new_user()` trigger runs as `SECURITY DEFINER` and bypasses RLS. Direct client inserts are denied by absence of policy. |
| `DELETE` | (no policy)                            | Account deletion is a backend concern (cascades to chats/messages); never a client direct call.                                     |

### `public.chats`

| Op       | Allowed when                                | Why                                                                                         |
| -------- | ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `SELECT` | `auth.uid() = user_id`                      | List/read your own chats.                                                                   |
| `INSERT` | `WITH CHECK (auth.uid() = user_id)`         | Can only create chats owned by yourself — forging another user's `user_id` fails the check. |
| `UPDATE` | `auth.uid() = user_id` (USING + WITH CHECK) | Rename / archive your own chats.                                                            |
| `DELETE` | `auth.uid() = user_id`                      | Delete your own chats.                                                                      |

### `public.messages`

| Op       | Allowed when                                                                              | Why                                                                                                          |
| -------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `SELECT` | `EXISTS (SELECT 1 FROM chats c WHERE c.id = messages.chat_id AND c.user_id = auth.uid())` | Read messages from your own chats — ownership transits through the chat row.                                 |
| `INSERT` | `WITH CHECK (...same...)`                                                                 | Can only post messages to your own chats.                                                                    |
| `UPDATE` | (no policy)                                                                               | **Messages are immutable** in the product. Implementation note: transcript history is append-only by design. |
| `DELETE` | `... same join check ...`                                                                 | Delete messages in your own chats.                                                                           |

### `public.prompt_logs` — INTERNAL

| Op    | Allowed when                                            | Why                                                                                                                                                                                                                                                                                                             |
| ----- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (all) | `RESTRICTIVE` policy `WITH CHECK (false) USING (false)` | **Deny everything.** Service role bypasses RLS by default — that's the only way data gets in/out. We use a `RESTRICTIVE` policy specifically because it AND-merges with any future permissive policies, so an accidental "users can read their own prompt_logs" policy in a later phase wouldn't override this. |

The table also has a `COMMENT ON TABLE` note saying "Internal-only IPE telemetry. No client access. Service role only." — that's the audit signal a reviewer needs.

## Why these specifics

1. **`auth.uid() = id`/`= user_id`** is the canonical Supabase scoping check. `auth.uid()` returns the JWT's `sub` claim or null when unauthenticated; comparing to a UUID column is fast (B-tree on the column).

2. **`USING` vs `WITH CHECK`.** `USING` is evaluated for SELECT/UPDATE/DELETE on rows already in the table; `WITH CHECK` is evaluated for INSERT/UPDATE on rows being written. We supply both on UPDATE because mutating the `user_id` column to point at another user must also fail.

3. **Restrictive vs permissive policies.** Most policies are permissive (default) — the row passes if any permissive policy says yes. `prompt_logs_deny_all` is RESTRICTIVE — it AND-merges with permissive ones so it can't be undone by adding a "users can see their own" policy later. Defense against future engineering mistakes.

4. **`SECURITY DEFINER` on the trigger.** `handle_new_user` runs as the table owner, not the inserting role, which lets it write into `public.users` even though `authenticated` has no INSERT policy there. The function sets `search_path = public` to prevent search-path hijacking attacks.

5. **`FORCE ROW LEVEL SECURITY` on every table.** Without `FORCE`, the table owner (which on Supabase is generally a privileged Postgres role) bypasses RLS even when reading via PostgREST. With `FORCE`, even owner connections are subject to policies. Belt-and-braces.

6. **Indexes on `user_id` and `chat_id`.** Already in Phase 1's schema. Without these, RLS join-checks on `messages` would table-scan every row at query time. The Phase 1 indexes turn each policy check into a single index seek.

## Verification

`tooling/scripts/verify-rls.ts` connects with the **anon key** (representing an unauthenticated client) and confirms every table returns 0 rows. Run via `pnpm tsx tooling/scripts/verify-rls.ts`.

Output should look like:

```
[verify-rls] testing as anon (unauthenticated) client
  ✓ users        rows=0
  ✓ chats        rows=0
  ✓ messages     rows=0
  ✓ prompt_logs  rows=0
[verify-rls] OK — RLS blocks anonymous access on all 4 tables
```

A leak (rows > 0 anywhere) means a policy is broken — exit code 1, blocks CI when wired up.

## Consequences

### Positive

- The database itself is the last line of defense. Even if a future engineer accidentally exposes a server-side endpoint that returns raw rows to anonymous clients, they get nothing.
- `prompt_logs` cannot be leaked through any client surface — the absence of any non-deny policy makes the surface area tiny.
- `verify-rls.ts` is a CI-friendly way to detect regressions.

### Negative / accepted trade-offs

- Every cross-table query (e.g. messages joined to chats) executes the policy check, which costs an index hit per row. Indexes already in place cover this; if the chat-message volume gets to billions of rows, we'll re-evaluate.
- The `prompt_logs` deny-all means even debugging via the dashboard requires connecting as `postgres` (service role) — a friction we accept because the table is sensitive enough to warrant it.

## References

- [Supabase RLS docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [PostgreSQL — CREATE POLICY](https://www.postgresql.org/docs/current/sql-createpolicy.html)
- ADR-0006 (Auth flow) — the application-side half of this story
- `packages/database/migrations/0001_auth_trigger_and_rls.sql` — the actual SQL
- `tooling/scripts/verify-rls.ts` — the verification script
