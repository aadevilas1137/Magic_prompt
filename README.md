# Magic Prompt AI

> Consumer AI SaaS — a Turborepo + pnpm monorepo with Next.js 14, Supabase, Drizzle, and a layered prompt-engineering pipeline (IPE) being built phase by phase.

[![CI](https://img.shields.io/badge/CI-pending-lightgrey)](.github/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](.nvmrc)
[![pnpm](https://img.shields.io/badge/pnpm-9-orange)](package.json)
[![TypeScript Strict](https://img.shields.io/badge/TS-strict-3178c6)](packages/config/typescript/base.json)

---

## Status

**Phase 1 — Foundation Scaffolding.** No business logic, no IPE, no real features yet. This commit lays down the rails: monorepo structure, tooling, configs, DB schema shells, auth wiring, an empty chat shell, and the full test/CI infrastructure.

See `temp_folder/PHASE_1_REPORT.md` for the per-phase report (gitignored).

---

## Prerequisites

| Tool | Version | Notes                                                      |
| ---- | ------- | ---------------------------------------------------------- |
| Node | 20 LTS  | Use `nvm use` (`.nvmrc` pinned to `20`)                    |
| pnpm | 9.15.0  | Activated via Corepack (`corepack prepare pnpm@9.15.0 -a`) |
| git  | any     | For Husky hooks                                            |

Optional services (provide credentials in `.env.local` to enable):

- **Supabase** — Postgres + Auth (`NEXT_PUBLIC_SUPABASE_URL`, anon key, service role)
- **Sentry** — error monitoring (`NEXT_PUBLIC_SENTRY_DSN`)
- **PostHog** — product analytics (`NEXT_PUBLIC_POSTHOG_KEY`)
- **OpenAI** — required from Phase 4+ (`OPENAI_API_KEY`)

---

## Quick start

```bash
# 1. Install Node 20 + pnpm
corepack enable
corepack prepare pnpm@9.15.0 --activate

# 2. Install workspace deps
pnpm install

# 3. Configure env (copy and fill)
cp .env.example apps/web/.env.local

# 4. Run the web app
pnpm dev
```

Open http://localhost:3000 — you'll see the empty chat shell. Visit `/api/health` for the JSON health probe.

---

## Scripts

| Script              | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| `pnpm dev`          | Start all apps in dev mode (Turbo)                       |
| `pnpm build`        | Production build for every package + app                 |
| `pnpm typecheck`    | `tsc --noEmit` across the workspace                      |
| `pnpm lint`         | ESLint flat config across the workspace                  |
| `pnpm lint:fix`     | ESLint with `--fix`                                      |
| `pnpm test`         | Vitest unit + integration                                |
| `pnpm test:e2e`     | Playwright E2E (requires `pnpm exec playwright install`) |
| `pnpm format`       | Prettier write                                           |
| `pnpm format:check` | Prettier verify                                          |
| `pnpm check-env`    | Validate `.env` against the Zod schema                   |
| `pnpm clean`        | Remove all build outputs and node_modules                |

---

## Folder map

```
magic-prompt-ai/
├── apps/web/             # Next.js 14 app (App Router)
├── packages/
│   ├── config/           # Shared TS / ESLint / Prettier / Tailwind configs
│   ├── shared/           # Cross-cutting types, Zod schemas, AppError
│   ├── database/         # Drizzle schema + client (Supabase Postgres)
│   ├── ui/               # Shared UI primitives (cn helper, shadcn host)
│   ├── llm/              # LLM provider interface (stub in Phase 1)
│   ├── ipe/              # Iterative Prompt Engineering pipeline (stub)
│   ├── logger/           # Pino structured logger
│   ├── analytics/        # PostHog wrapper
│   └── observability/    # Sentry wrapper
├── tooling/scripts/      # check-env.ts and other dev scripts
├── docs/                 # Architecture, ADRs, contributing, standards
└── temp_folder/          # Per-phase reports (gitignored)
```

---

## Architecture

See [`docs/architecture/overview.md`](docs/architecture/overview.md) for the high-level architecture, and [`docs/architecture/ADR/`](docs/architecture/ADR/) for individual decision records:

- [ADR-0001](docs/architecture/ADR/0001-monorepo-turborepo.md) — Monorepo with Turborepo + pnpm
- [ADR-0002](docs/architecture/ADR/0002-orm-drizzle.md) — Drizzle ORM
- [ADR-0003](docs/architecture/ADR/0003-auth-supabase.md) — Supabase Auth
- [ADR-0004](docs/architecture/ADR/0004-state-zustand-tanstack.md) — State (Zustand + TanStack Query)
- [ADR-0005](docs/architecture/ADR/0005-testing-vitest-playwright.md) — Testing (Vitest + Playwright + MSW)

---

## Contributing

Read [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) and [`docs/CODING_STANDARDS.md`](docs/CODING_STANDARDS.md) before opening a PR. TL;DR — strict TypeScript, conventional commits, all tests green.

---

## License

[MIT](LICENSE)
