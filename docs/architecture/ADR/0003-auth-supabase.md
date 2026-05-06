# ADR-0003: Supabase Auth

- **Status:** Accepted
- **Date:** 2026-05-05
- **Phase:** 1

## Context

We need email + OAuth auth, session management that works on Next.js's three runtimes (Node, edge, browser), and we already lean on Supabase Postgres for persistence. We don't want to glue together a separate auth provider, a separate Postgres host, and a separate token-refresh story.

## Decision

Use **Supabase Auth** via `@supabase/ssr`. Session refresh runs in `apps/web/src/middleware.ts` on every navigation. The application `users` table is keyed by `auth.users.id` (1:1 mapping), so domain queries can join on the same UUID without a translation layer.

## Consequences

### Positive

- One vendor for Auth + Postgres — one bill, one dashboard, one set of credentials.
- `@supabase/ssr` handles cookie management on Server Components, Route Handlers, and Middleware in a single API.
- Magic links, OAuth, and password flows all out of the box.
- Easy local dev with Supabase CLI.

### Negative / accepted trade-offs

- Lock-in: migrating off Supabase later means rebuilding the auth flow on a different provider (the Postgres data itself is portable).
- RLS is the canonical authorization model. Queries that bypass RLS (with the service role key) must be reviewed carefully.
- Custom session claims require Postgres functions / hooks rather than ad-hoc middleware.

## Alternatives considered

- **NextAuth.js / Auth.js** — flexible, but pairing it with Supabase Postgres and keeping the user IDs in sync is extra plumbing.
- **Clerk** — best-in-class developer experience; rejected because Supabase already gives us auth and we want to minimise vendors.
- **Roll our own** — not at our team size.

## References

- [`@supabase/ssr`](https://supabase.com/docs/guides/auth/server-side)
- [Supabase Auth — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
