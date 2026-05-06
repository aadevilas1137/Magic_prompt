# ADR-0004: State management — Zustand (client) + TanStack Query (server)

- **Status:** Accepted
- **Date:** 2026-05-05
- **Phase:** 1

## Context

Two distinct kinds of state:

1. **Server state** — chats, messages, the current user. Lives in Postgres; we mirror it on the client and need cache invalidation, retries, optimistic updates, mutation flows.
2. **Client state** — the chat composer's draft, theme, ephemeral UI flags. Never persisted to the server.

Conflating these into a single store (Redux for everything) is the historical mistake. Each kind has different semantics.

## Decision

- **TanStack Query** for server state. One `QueryClient` provided at the root via `QueryProvider`. Query keys live in `lib/constants.ts` (`QUERY_KEYS`).
- **Zustand** for client state. One store per concern (`useChatStore`, `useUIStore`, …) under `src/stores/`. No global mega-store.

## Consequences

### Positive

- TanStack Query's cache + retry + dedup gives us behaviour that would otherwise be hand-rolled.
- Zustand stores are tiny, type-safe, and have no provider boilerplate.
- The two-axis split makes code reviews easier: a state PR is either server-shape (query/mutation) or client-shape (Zustand) — never both.

### Negative / accepted trade-offs

- Two libraries to learn instead of one. Worth it for the conceptual clarity.
- Devtools are split (TanStack Query Devtools + Zustand Devtools middleware).

## Alternatives considered

- **Redux Toolkit + RTK Query** — strong choice; rejected because TanStack Query has nicer SSR + suspense ergonomics in the App Router and Zustand is materially smaller for client state.
- **Jotai / Recoil** — atomic state libs are powerful but bring an extra mental model we don't currently need.
- **React Context everywhere** — fine for a tiny app; performance cliff once we have many subscribers.

## References

- [TanStack Query](https://tanstack.com/query)
- [Zustand](https://zustand.docs.pmnd.rs/)
