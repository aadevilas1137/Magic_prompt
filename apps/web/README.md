# `@magic-prompt/web`

Next.js 14 App Router + TypeScript strict + Tailwind + shadcn/ui + Supabase + next-intl + TanStack Query + Zustand.

## Phase 2 contents (current)

- **Auth flows** — login, signup, forgot-password, reset-password, email-verify, OAuth (Google) at `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`. OAuth callback at `/auth/callback` (NOT under [locale]).
- **Auth-gated `/chat`** — middleware redirects unauthenticated visits to `/login?redirect=/chat`; `requireUser()` is the second-layer guard at the page level.
- **i18n with URL routing** — `/login` (English, default) and `/hi/login` (Hindi). Locales: `en`, `hi`. Route group `[locale]` segment.
- **Header** — logo + theme toggle + language switcher + user menu (when authed) or sign-in/up buttons (when not).
- **Toaster** — `sonner` mounted at the root for action feedback.
- **DB trigger + RLS** — see `packages/database/README.md`. Runs in your Supabase project after `db:migrate`.
- **Rate limiting** — in-memory per-IP-per-endpoint via `lru-cache`.
- **Empty chat shell at `/chat`** — composer still disabled (chat wires up in Phase 3).

## Auth flow at a glance

```
Browser                Server                Supabase             Postgres
   │                      │                     │                    │
   ├─ POST /signup ──────▶│                     │                    │
   │                      ├─ rateLimit          │                    │
   │                      ├─ Zod validate       │                    │
   │                      ├─ supabase.auth.signUp ──▶ creates auth.users
   │                                                    │  ─trigger─▶ public.users
   │                                                    └─ sends verification email
   │◀──────── redirect /verify-email ─────────────────────
   │ user clicks email link
   ├─ GET /auth/callback?code=xxx ───────▶│
   │                      ├─ exchangeCodeForSession ──▶ session cookie set
   │◀──────── redirect /chat ─────────────
   │
   ├─ GET /chat ────────▶ middleware: getUser ──▶ valid → pass
   │                      ├─ page: requireUser ─▶ valid → render
   │◀────── chat shell ───
```

Full architecture: [`docs/architecture/ADR/0006-auth-flow.md`](../../docs/architecture/ADR/0006-auth-flow.md).
RLS design: [`docs/architecture/ADR/0007-rls-policy-design.md`](../../docs/architecture/ADR/0007-rls-policy-design.md).

## Phase 1 contents (still here)

- Empty chat shell at `/chat`
- `/api/health` JSON probe
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
