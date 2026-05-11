# `@magic-prompt/web`

Next.js 14 App Router + TypeScript strict + Tailwind + shadcn/ui + Supabase + next-intl + TanStack Query + Zustand.

## Phase 3 contents (current)

- **Auth flows** (Phase 2) — login, signup, forgot/reset password, verify-email, Google OAuth.
- **Chat surface** — `/chat` (welcome), `/chat/new` (auto-create + redirect), `/chat/[chatId]` (chat view). Sidebar with date-grouped chat list + per-item rename/delete/archive menu. Mobile drawer + desktop docked layout.
- **Streaming `/api/chat`** — Node.js runtime, `maxDuration=60`. Auth + Zod + chat-ownership + rate-limit + persist-user-message-first → `OpenAIProvider.stream()` (gpt-4o by default) → `onFinish` persists assistant message + token/latency metrics + triggers auto-title generation.
- **Auto-title** — fires after first user-assistant exchange via cheaper `gpt-4o-mini`. Falls back silently if it fails.
- **Markdown rendering** — `react-markdown` + GFM + Prism syntax highlighting + `isomorphic-dompurify` URL sanitisation. XSS-defended.
- **Optimistic mutations** — create / delete / rename / archive chats; cache-roll-forward on success, rollback on failure.
- **Draft persistence** — composer drafts persist per-`chatId` in localStorage; survive navigation + refresh.
- **i18n** — full chat keyspace in `messages/en.json` + `messages/hi.json` (Hindi machine-translated, flagged for native review).
- **Analytics** — 13 PostHog events wired (chat lifecycle + message lifecycle + composer interactions). No PII, no message content.

## Chat architecture — sequence

```
Browser                  /api/chat                  Drizzle / Supabase JS               OpenAI
   │                         │                              │                              │
   ├─ POST {chatId, msgs} ──▶│                              │                              │
   │                         ├─ getUser() (cookie-validated)│                              │
   │                         ├─ Zod parse body              │                              │
   │                         ├─ verify chat ownership ─────▶ SELECT chats WHERE id=…       │
   │                         │  AND user_id=…               │                              │
   │                         ├─ checkRateLimit (60/min/user)│                              │
   │                         ├─ INSERT user message ───────▶ INSERT messages (role=user)   │
   │                         │  (persist FIRST — survives LLM failure)                     │
   │                         ├─ load last N (env.CHAT_CONTEXT_WINDOW)                      │
   │                         │  ───────────────────────────▶ SELECT messages ORDER created │
   │                         ├─ buildLLMContext (drop errored turns, prepend system)       │
   │                         ├─ provider.stream(context) ───────────────────────────────▶ │
   │                         │                                                              │
   │ ◀─── stream tokens ─────┤◀─── token-by-token (UIMessage stream protocol) ──────────────┤
   │                         │                                                              │
   │                         ├─ onFinish ─▶ INSERT messages (role=assistant, tokenCount,    │
   │                         │              model, latencyMs) + UPDATE chats.model           │
   │                         │           + trigger fires → bump chats.last_message_at        │
   │                         │           + (async) generateChatTitle if currentTitle is default
   │                         │                                                              │
   │ ◀─ stream finish ───────┤                                                              │
```

Client side: `useStreamingChat` (in `features/chat/hooks/`) wraps AI SDK's `useChat` from `@ai-sdk/react`. It seeds the conversation with server-loaded persisted messages so there's no flash of empty state, and on `onFinish` invalidates TanStack Query keys + calls `router.refresh()` so the sidebar reorders by `last_message_at` and the new auto-generated title appears.

For full design rationale see [`ADR-0008`](../../docs/architecture/ADR/0008-streaming-with-vercel-ai-sdk.md) (streaming choice), [`ADR-0009`](../../docs/architecture/ADR/0009-chat-data-model.md) (data model), and [`ADR-0010`](../../docs/architecture/ADR/0010-no-ipe-yet.md) (chat-first vs IPE-first decision).

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
