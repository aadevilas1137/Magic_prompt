# Architecture Overview

> Status: Phase 1 — foundation only. The diagram below shows the **target** architecture that subsequent phases will fill in.

## High level

```
                     ┌────────────────────────────────────┐
   browser ◀────────▶│  apps/web  (Next.js 14, App Router)│
                     │  ── React Server / Client          │
                     │  ── Tailwind + shadcn/ui           │
                     │  ── next-intl                      │
                     └────┬───────────────────────────┬───┘
                          │                           │
                  Server Actions                Route Handlers
                          │                           │
                          ▼                           ▼
     ┌───────────────────────────────────────────────────────────────┐
     │                     packages/  (workspace libs)                │
     │                                                                │
     │   shared        ipe          llm         database              │
     │   logger        analytics    observability   ui   config       │
     └───────────────────────────────────────────────────────────────┘
                          │                           │
                          ▼                           ▼
                ┌───────────────────┐     ┌────────────────────┐
                │  Supabase         │     │  LLM Providers     │
                │  Auth + Postgres  │     │  OpenAI (Phase 4)  │
                │                   │     │  Anthropic, Google │
                └───────────────────┘     └────────────────────┘
```

## Layers

| Layer           | Where                                                             | Purpose                                                    |
| --------------- | ----------------------------------------------------------------- | ---------------------------------------------------------- |
| Routing / UI    | `apps/web/src/app`                                                | App Router pages, layouts, route handlers                  |
| Feature modules | `apps/web/src/features/<name>`                                    | Feature-sliced components/hooks/types                      |
| Cross-app libs  | `packages/shared`                                                 | Types, Zod schemas, `AppError`, error codes                |
| Persistence     | `packages/database`                                               | Drizzle schema + client (Supabase Postgres)                |
| Auth            | `apps/web/src/lib/supabase`                                       | Browser/server/middleware Supabase clients                 |
| Prompt pipeline | `packages/ipe` + `packages/llm`                                   | IPE orchestration + LLM provider/router (stubs in Phase 1) |
| Observability   | `packages/logger`, `packages/observability`, `packages/analytics` | Pino, Sentry, PostHog                                      |
| Shared UI       | `packages/ui`                                                     | `cn()` helper + shared shadcn host                         |
| Configs         | `packages/config/{ts,eslint,prettier,tailwind}`                   | Shared TS / ESLint / Prettier / Tailwind presets           |

## Boundary rules

1. **Apps depend on packages, never the reverse.** A package must not import from `apps/web`.
2. **No package imports from another package's internal paths.** Only the package's `exports` map.
3. **Server-only code** (Supabase server client, route handlers) lives under `src/app/api`, `src/lib/supabase/server.ts`, or files marked with `import 'server-only'`.
4. **Validation at boundaries.** Every external input (HTTP, env, form) is parsed through a Zod schema before it touches business code.
5. **Errors are typed.** Throw `AppError` with an `ErrorCode`. Never throw raw strings.
6. **Logging is structured.** `createLogger(scope)` from `@magic-prompt/logger`. Never `console.log` in src.

## Data flow (Phase 4+, target)

```
user input → validate (Zod) → IPE pipeline (parse → classify → enrich → rewrite → critique → refine → finalize)
            → LLM router (provider selection)        → response
            → persist to messages + prompt_logs      → analytics event
```

## Reading order for new engineers

1. `README.md` (root) — project overview + scripts
2. `docs/CODING_STANDARDS.md` — what "production-grade" means here
3. `docs/CONTRIBUTING.md` — how to ship a change
4. `docs/architecture/ADR/*` — the decisions and the why
5. `apps/web/README.md` — frontend specifics
6. `packages/database/README.md` — schema + Supabase setup
