# ADR-0002: Drizzle as our ORM

- **Status:** Accepted
- **Date:** 2026-05-05
- **Phase:** 1

## Context

Postgres on Supabase is our primary store. We need:

- Type-safe queries that compile away.
- A migration tool we can read and audit (i.e. plain SQL, not magic).
- Edge-runtime compatibility for Next.js route handlers.
- A small bundle so the cold-start cost stays low.

## Decision

Use **Drizzle ORM** with the `postgres-js` driver, schema files under `packages/database/src/schema/`, migrations in `packages/database/migrations/`.

## Consequences

### Positive

- Schemas read like Postgres — `pgTable`, `uuid`, `timestamp`, `pgEnum` — so reviewers don't fight an abstraction.
- `drizzle-kit generate` produces plain SQL migrations we commit to the repo.
- Result types are inferred from the schema (`typeof users.$inferSelect`).
- Works in both Node and edge runtimes; no decorator/reflection requirement.

### Negative / accepted trade-offs

- Less mature ecosystem than Prisma. Some advanced features (relations API, typed transactions) shipped only recently.
- Hand-managing relations in queries is more verbose than Prisma's nested-include API.

## Alternatives considered

- **Prisma** — heavier runtime, edge-runtime story has improved but isn't free, and the rust binary made cold starts painful in serverless.
- **Kysely** — close second; we like the type-only approach. We chose Drizzle for the SQL-DSL ergonomics around schemas + migrations.
- **Raw SQL + zod** — works at small scale but loses refactoring safety.

## References

- [Drizzle ORM](https://orm.drizzle.team/)
- [postgres-js](https://github.com/porsager/postgres)
