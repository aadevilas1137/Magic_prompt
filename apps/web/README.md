# `@magic-prompt/web`

Next.js 14 App Router + TypeScript strict + Tailwind + shadcn/ui + Supabase + next-intl + TanStack Query + Zustand.

## Phase 1 contents

- Empty chat shell at `/chat` (composer disabled — Phase 2 wires it)
- `/api/health` JSON probe
- Supabase auth wiring (no flows yet — Phase 2)
- next-intl with `en` (folder ready for `hi` in Phase 2)
- All providers composed (Theme, Query, NextIntl)
- Vitest unit + integration tests, Playwright E2E
- Strict TypeScript, ESLint flat config, Prettier

## Local dev

```bash
cp .env.example .env.local        # fill any creds you have
pnpm --filter @magic-prompt/web dev
```

The app boots even without Supabase/Sentry/PostHog credentials — they degrade to safe no-ops. Without `DATABASE_URL`, `/api/health` returns `db: "disconnected"`.

## Scripts

| Script              | Purpose                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| `dev`               | Next dev server                                                         |
| `build`             | Production build                                                        |
| `start`             | Run the production build                                                |
| `lint` / `lint:fix` | ESLint via Next                                                         |
| `typecheck`         | `tsc --noEmit` (strict)                                                 |
| `test`              | Vitest unit + integration                                               |
| `test:coverage`     | Vitest with v8 coverage                                                 |
| `test:e2e`          | Playwright (browsers must be installed: `pnpm exec playwright install`) |

## Folder map

```
apps/web/
├── src/
│   ├── app/             # Routes (App Router)
│   │   ├── (auth)/      # Auth route group (Phase 2)
│   │   ├── (chat)/      # Chat route group
│   │   ├── api/health/  # Health probe
│   │   ├── layout.tsx, page.tsx, error.tsx, not-found.tsx, loading.tsx
│   │   └── globals.css
│   ├── components/      # App-level UI (providers, layout)
│   ├── features/chat/   # Feature-sliced chat module
│   ├── lib/             # env, utils, supabase clients, constants
│   ├── i18n/            # next-intl config + request resolver
│   ├── stores/, hooks/  # Zustand stores, custom hooks (added per phase)
│   └── middleware.ts    # Supabase session refresh
├── messages/en.json     # i18n strings
├── tests/
│   ├── unit/, integration/, e2e/
│   └── mocks/           # MSW
└── public/
```

## Conventions

- Imports use the `@/*` path alias (mapped to `src/*`).
- Server-only code never imports from `lib/supabase/client.ts`. Client components never import from `lib/supabase/server.ts`.
- All env access goes through `lib/env.ts`. No raw `process.env.X` in src code.
- Errors thrown from any layer use `AppError` from `@magic-prompt/shared`.
