# Coding Standards

The rules we don't relitigate. Read once.

## TypeScript

- **`strict: true` plus** `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noImplicitReturns`. Configured in `@magic-prompt/tsconfig/base.json`.
- **No `any`.** Use `unknown` and narrow. The `@typescript-eslint/no-explicit-any` rule is `error`.
- **No `@ts-ignore` without a reason.** If you must, write `@ts-expect-error <reason>` so the compiler removes it once the underlying issue is fixed.
- **Exhaustive switch** with `never`:
  ```ts
  switch (kind) {
    case 'a': return …;
    case 'b': return …;
    default: { const _exhaustive: never = kind; throw _exhaustive; }
  }
  ```
- **Prefer `interface` for public shapes**, `type` for unions / utility types.

## Naming

| Item                | Convention                         | Example                               |
| ------------------- | ---------------------------------- | ------------------------------------- |
| Files               | `kebab-case.ts`                    | `chat-shell.tsx`, `prompt-logs.ts`    |
| Components          | `PascalCase`                       | `ChatShell`, `Providers`              |
| Hooks               | `useX` in code, `use-x.ts` on disk | `useChatDraft` in `use-chat-draft.ts` |
| Types / interfaces  | `PascalCase`                       | `LLMProvider`                         |
| Enum-like constants | `SCREAMING_SNAKE`                  | `APP_NAME`, `ROUTES.CHAT`             |
| Booleans            | `is…` / `has…` / `should…`         | `isAuthenticated`                     |

## Imports

- Use the `@/*` alias inside `apps/web` (mapped to `src/*`).
- Use the package name for cross-package imports: `import { AppError } from '@magic-prompt/shared'` (never a relative `../../../packages/...`).
- Sort: builtin/external → internal (`@magic-prompt/*`) → parent/sibling/index → type-only. Enforced by `import/order`.
- One blank line between groups.
- `import type { … }` for type-only imports (`@typescript-eslint/consistent-type-imports`).

## Errors

- Throw `AppError` from `@magic-prompt/shared`, never raw strings or generic `Error`.
- Pick a code from `ErrorCode`. The HTTP status comes for free via `HTTP_STATUS_BY_CODE`.
- Attach a `cause` when wrapping a lower-level error.
- Attach `metadata` for structured context the logs / Sentry will read.

## Logging

- `createLogger(scope)` from `@magic-prompt/logger`. **Never `console.log` in `src/`** (the rule allows `console.warn` / `console.error`).
- Log objects, not strings: `log.info({ userId, chatId }, 'persisted message')` — Pino handles structure, redaction, and JSON.

## Validation

Validate at every boundary with Zod:

- Env: `apps/web/src/lib/env.ts`
- HTTP request bodies: parse in the route handler before calling business code
- Form input: React Hook Form + `zodResolver`
- External-API responses: parse before trusting

## React

- Server Components by default. Mark client boundaries explicitly with `'use client'` at the **top** of the file.
- No `useEffect` for data fetching — use TanStack Query.
- Stable identity for callbacks passed to memoised children (`useCallback`).
- ARIA on every interactive element. Use semantic HTML first (`<button>` over `<div onClick>`).

## Tailwind

- Use the `cn()` helper to combine class strings.
- Prefer the design tokens from `@magic-prompt/tailwind-config` (`bg-background`, `text-foreground`, …) over raw colours.
- Compose with `class-variance-authority` (`cva`) for variant-heavy components.

## Comments

- Default to **none.** Names should carry the meaning.
- Write a comment when the _why_ is non-obvious — a hidden constraint, a workaround for a specific bug, a subtle invariant.
- Don't reference the PR or the ticket — that belongs in the commit message.

## Tests

- Unit tests next to the conceptual unit, named `*.test.ts(x)`. They live under `tests/unit/` for the web app.
- Integration tests cover route handlers + server actions (`tests/integration/`).
- E2E tests cover golden paths only (`tests/e2e/`). Don't try to E2E every edge case — that's what unit/integration are for.
- Every PR that adds behaviour adds a test. Every PR that fixes a bug adds a regression test.

## Security

- Never log secrets. The Pino redact list catches the obvious ones; if you add a new sensitive field, extend it.
- Validate every external input. Treat anything from the network as hostile.
- The Supabase **service role key** is server-only. Never import it into a client file.
- The Drizzle `prompt_logs` table is internal. No public route reads from it without a deliberate ADR.

## Auth (Phase 2+)

The full architecture lives in [`docs/architecture/ADR/0006-auth-flow.md`](architecture/ADR/0006-auth-flow.md) and [`ADR-0007`](architecture/ADR/0007-rls-policy-design.md). Day-to-day rules:

- **Authorization always uses `getUser()`, never `getSession()`.** `getSession()` trusts the cookie blindly; `getUser()` round-trips to Supabase to validate. Use the latter from `@/lib/auth/get-user` in any code that gates access.
- **Server-only files import `'server-only'` at the top.** That's the runtime fence. Don't import server modules into client files.
- **Forms call Server Actions, not API routes.** New auth-adjacent flows go in `apps/web/src/features/auth/actions/` and follow the existing pattern: Zod validate → rate-limit → Supabase call → `mapSupabaseAuthError` → Pino log + PostHog track → `redirect`.
- **Never expose raw Supabase error messages to the browser.** Always route them through `mapSupabaseAuthError`. Unknown codes fall back to a generic message; the original is attached as `cause` for server-side logs.
- **Open-redirect protection.** Use `safeRedirect()` from `@/features/auth/lib/safe-redirect` whenever a redirect target comes from user input (URL param, form field, header).
- **Rate limiting.** Every auth-mutating action calls `checkRateLimit(name, ip:email, RateLimits[name])` BEFORE the Supabase call. Pre-configured limits live in `RateLimits` — adjust there, not in call sites.
- **No PII in logs.** Email is OK (it's the user's identifier and shows up in toasts anyway). Never log passwords, tokens, magic links, or whatever the user typed into a form.
- **Defense in depth: middleware + page guard + RLS.** Auth-required pages call `requireUser('/chat')` even though middleware already redirects unauthenticated visitors. RLS in the database is the third layer.
- **`prompt_logs` has zero client access.** It's enforced by a `RESTRICTIVE` deny-all RLS policy. Service-role-only writes from the IPE pipeline (Phase 4+).

## Streaming + AI SDK (Phase 3+)

The chat surface uses the Vercel AI SDK (v6). The full architectural rationale is in [`ADR-0008`](architecture/ADR/0008-streaming-with-vercel-ai-sdk.md). Day-to-day rules:

- **Streaming routes live in `/api/*` Route Handlers, never in Server Actions.** Server Actions don't support streaming responses; the AI SDK's `useChat` client expects a Route Handler endpoint.
- **Always declare runtime + maxDuration** on streaming routes:
  ```ts
  export const runtime = 'nodejs'; // Drizzle/postgres-js requires Node
  export const maxDuration = 60; // Vercel Pro cap; Hobby is 10s — document on routes that depend on it
  ```
- **Persist the user message BEFORE calling the LLM.** If the LLM call fails, the user's input survives in the DB and the UI can offer a clean retry.
- **Wrap LLM calls through `@magic-prompt/llm`, not the AI SDK directly.** The provider abstraction owns error mapping (OpenAI errors → `AppError`), retry/timeout behaviour, and is the seam where Phase 8+ multi-provider routing lands. Route handlers call `provider.stream(...)`, not `streamText(...)` from `ai`.
- **`onFinish` is where you write the assistant message to the DB.** Use the normalised `usage` (with `promptTokens`/`completionTokens`/`totalTokens` regardless of SDK version) — the provider hides the v3→v6 rename of `inputTokens`/`outputTokens` from callers.
- **Treat LLM output as untrusted.** Always render through `MarkdownRenderer` (in `features/chat/components/markdown/`) which combines `react-markdown` (no raw HTML by default), `urlTransform` (blocks `javascript:` / `data:` / `vbscript:` URLs), and `isomorphic-dompurify` as belt-and-braces.
- **Never log message content.** Chat-side Pino calls include `chatId`, `userId`, `err.message`, model id, token counts, latency. The body of a turn never appears in logs.
- **Provider construction reads `OPENAI_API_KEY` from `process.env` at call time.** Don't import `env.ts` into provider unit tests — pass `new OpenAIProvider({ sdk: fakeSdk })` to bypass the env check.
- **Title generation is fire-and-forget.** Call `void generateChatTitle({...})` from `onFinish`. Failures log a warn and keep the previous title; never block the response on title gen.
- **Pino transports: opt-in only.** `pino-pretty` spawns a worker thread that Next dev's webpack can't always trace. The default logger is JSON-only; set `LOGGER_PRETTY=true` or pipe `pnpm dev | pino-pretty` if you want colour locally.
- **Client files must NOT import `@/lib/env`.** The env module parses the full schema at module load — including server-only required keys like `OPENAI_API_KEY` — and bundles that into the client. Strict validation then crashes on hydration because the browser can't see non-`NEXT_PUBLIC_*` env vars. Concrete rule:
  - In a `'use client'` file, read `NEXT_PUBLIC_*` values directly: `const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';` — Next inlines these at build.
  - For server-only values that a client component needs (e.g. `CHAT_MAX_MESSAGE_LENGTH`), have the parent Server Component read `env` and pass the value down as a prop.
  - Common gotcha: `lib/supabase/client.ts` (the browser-side Supabase factory) is a client module, despite being a `lib/` file. It cannot import `env`. Treat anything in `lib/` as suspect — check whether its consumers are client or server.
