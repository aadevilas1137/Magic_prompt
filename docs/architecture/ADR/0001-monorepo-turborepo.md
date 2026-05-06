# ADR-0001: Monorepo with Turborepo + pnpm workspaces

- **Status:** Accepted
- **Date:** 2026-05-05
- **Phase:** 1

## Context

Magic Prompt AI will eventually ship a web app, internal tooling, an admin app, and possibly a mobile/desktop client. Across all of those we want to share types, schemas, error codes, the IPE pipeline, the LLM router, the database schema, the Sentry/PostHog/Pino wrappers, and the design system. We also want one lockfile, one CI cache, one TS config story, and one ESLint/Prettier story.

Polyrepo would mean publishing each shared library to a private registry, versioning every change, and reconciling versions in the apps. Too much friction for a small team.

## Decision

A single git repo organised as a Turborepo monorepo with pnpm workspaces.

- **pnpm workspaces** for fast, deterministic, content-addressable installs.
- **Turborepo** for task pipelining, remote caching, and `dependsOn` semantics.
- Internal packages are referenced via `workspace:*` and consumed as TS source — bundled at the app boundary by Next.js (`transpilePackages`). No per-package build step in Phase 1.

## Consequences

### Positive

- Refactors that span an app + multiple packages happen in one PR.
- Shared types and Zod schemas have a single source of truth (`@magic-prompt/shared`).
- Turbo cache makes `lint` / `typecheck` / `test` repeatedly cheap in CI.
- One ESLint config, one Prettier config, one TS strict config — applied everywhere.

### Negative / accepted trade-offs

- One `pnpm install` is heavier than a single-app install.
- Package authors must keep their `exports` field truthful and `tsconfig` references clean — there is no published version to fall back on.
- Turborepo introduces another tool the team must learn.

## Alternatives considered

- **Nx** — more opinionated, larger surface area; we don't need its generators or affected-graph features yet.
- **Lerna** — effectively superseded by pnpm workspaces + Turbo.
- **Polyrepo + private registry (Verdaccio / GitHub Packages)** — too much ceremony for the team size and the iteration speed we want in early phases.

## References

- [Turborepo docs](https://turbo.build/repo/docs)
- [pnpm workspaces](https://pnpm.io/workspaces)
