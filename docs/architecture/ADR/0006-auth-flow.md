# ADR-0006: Auth flow architecture

- **Status:** Accepted
- **Date:** 2026-05-06
- **Phase:** 2

## Context

Phase 2 ships the authentication system that gates the entire product. We need:

- Email + password (the lowest-friction onboarding path)
- Google OAuth (sign-in conversions are 30–50% higher with social options)
- Email verification before first login (prevents drive-by spam signups)
- Password reset via email
- Session management that works on all three Next.js runtimes (Node, edge, browser) and never trusts the cookie blindly on a server-rendered page
- Defense in depth: middleware guard + page-level guard + RLS, all enforced
- Rate limiting at the application boundary (before Supabase's own limits kick in)

## Decision

Layer the auth system as follows, top to bottom:

```
┌───────────────────────────────────────────────────────────────┐
│  Auth UI (apps/web/src/features/auth/components/*)           │
│    React Hook Form + Zod resolver → renders Server Action    │
│    state via useFormState; shows toast/inline errors.        │
├───────────────────────────────────────────────────────────────┤
│  Server Actions (apps/web/src/features/auth/actions/*)       │
│    1. Zod validate                                            │
│    2. checkRateLimit(name, ip:email, RateLimits[name])       │
│    3. supabase.auth.<method>(...)                             │
│    4. mapSupabaseAuthError → AppError                         │
│    5. Pino log (no secrets) + PostHog track                   │
│    6. revalidatePath + redirect on success                    │
├───────────────────────────────────────────────────────────────┤
│  lib/auth helpers (apps/web/src/lib/auth/*)                   │
│    getUser(): User | null  — validates JWT against Supabase   │
│    requireUser(path): User — redirect to /login if anon       │
│    getSession(): Session | null — cheap cookie probe          │
├───────────────────────────────────────────────────────────────┤
│  Middleware (apps/web/src/middleware.ts)                      │
│    - Refresh Supabase session via @supabase/ssr               │
│    - Auth gate against PROTECTED / AUTH_ONLY prefix lists     │
│    - Compose with next-intl routing AFTER auth gate           │
│    - Skip /auth/callback entirely (Supabase needs stable URL) │
├───────────────────────────────────────────────────────────────┤
│  Database — RLS policies + handle_new_user trigger            │
│    See ADR-0007 for the policy design.                        │
└───────────────────────────────────────────────────────────────┘
```

### Key decisions

1. **Server Actions, not raw API routes.** `app/api/auth/*` wasn't created. Server Actions give us per-call CSRF tokens, automatic re-validation, no JSON parsing boilerplate, and tight type-coupling with React's `useFormState`. The downsides — discoverability and external API consumers — don't apply yet (we have no third-party clients).

2. **`@supabase/ssr`, not `auth-helpers`.** The auth-helpers package is in maintenance mode; Supabase's own docs now point at `@supabase/ssr` for Next.js App Router. The two run differently — `auth-helpers` reads cookies directly, `@supabase/ssr` uses a cookie-getter/setter contract that lets us inject our own.

3. **Always `auth.getUser()` for authorization, never `getSession()`.** `getSession()` returns the cookie's claim without verifying it; `getUser()` round-trips to Supabase Auth to validate the JWT. The cost is one extra RPC, and the benefit is that a tampered cookie can't pretend to be a logged-in user. We use `getSession()` only for cheap "is the user logged in at all?" probes where we already trust the cookie (middleware after refresh).

4. **Defense in depth, three layers.**
   - Middleware redirects unauthenticated users away from `/chat`
   - The chat page itself calls `requireUser('/chat')` — second line of defense if middleware is bypassed (e.g. directly hitting a route handler)
   - RLS in the database scopes data to `auth.uid()` — even a leaked anon key can only read its own rows
     These three checks should never disagree; if they do, that's a bug to fix, not a redundancy to remove.

5. **Application-layer rate limiting before Supabase's.** `lru-cache`-backed limiter in `features/auth/lib/rate-limit.ts` enforces 5 logins / 15 min, 3 signups / hr, 3 forgot-password / hr, 3 resend-verification / hr. **Per-process only — replace with Redis in Phase 11.** This is documented in the rate-limit module itself.

6. **Open-redirect protection on every redirect.** `safeRedirect()` rejects absolute URLs, protocol-relative URLs, scheme injections (`javascript:`, `data:`), and Windows-path tricks. Used by the login action when honoring `?redirect=` from the URL.

7. **Generic success on forgot-password regardless of supabase result.** Even when Supabase reports `user_not_found`, we return the same success message to the client. This kills email enumeration as an attack vector.

8. **Never expose raw Supabase error messages to the browser.** `mapSupabaseAuthError` translates supported codes to safe user-facing strings; unknown codes fall back to a generic "Something went wrong." The original error is attached as `cause` for server-side logging.

## Consequences

### Positive

- One bundle, one runtime story for auth — no cross-API-route serialization needs.
- Strict type-coupling between forms and actions via shared `AuthActionState` discriminated union.
- Anyone reading a form file can trace exactly which Server Action runs and what server-side validation/rate-limiting protects it.
- The RLS layer means even if an attacker bypasses Step 1 + Step 2, they still can't read other users' data.

### Negative / accepted trade-offs

- Server Actions don't have a JSON-API surface for non-browser clients. When that becomes a need, we'll add `app/api/auth/*` route handlers that wrap the actions.
- In-memory rate limiter resets on every server restart and doesn't scale across multiple serverless instances. Acceptable for Phase 2; Phase 11 swaps the backing store.

## Alternatives considered

- **NextAuth.js** — flexible, but stitching it to Supabase Postgres (where our data lives) is extra plumbing for no auth-flow benefit.
- **Clerk** — best-in-class DX; rejected because Supabase already gives us auth + DB and we want to minimize vendors.
- **Custom JWT** — not at our team size or threat model.

## References

- [Supabase Auth — server-side workflows](https://supabase.com/docs/guides/auth/server-side)
- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- ADR-0003 (Supabase Auth) — the original adoption decision in Phase 1
- ADR-0007 (RLS policy design) — the database half of this story
