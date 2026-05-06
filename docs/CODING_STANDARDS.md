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
