# ADR-0008: Streaming chat responses via the Vercel AI SDK

- **Status:** Accepted
- **Date:** 2026-05-11
- **Phase:** 3

## Context

Phase 3 ships the first user-visible chat surface. The non-negotiables:

- **Token-by-token streaming** — perceived latency on a 30-second response drops by 10x when tokens appear progressively versus all-at-once.
- **Browser back/forward + reconnection resilience** — a partial stream should resume cleanly, not orphan a half-written message.
- **One canonical endpoint** — the route accepts the full message history from the client, runs auth + rate limits, calls the LLM, persists results.

Three approaches were considered:

1. **Raw `openai` SDK + manual SSE plumbing.** Maximum control, but every byte of streaming protocol, every reconnection corner-case, every browser quirk lands on us. No future-proofing for additional providers.
2. **Server-Sent Events from a Next.js Route Handler, hand-rolled.** Same control as raw OpenAI; arguably leaner than the AI SDK. But provider swap is still manual.
3. **Vercel AI SDK** (`ai` + `@ai-sdk/openai` server, `@ai-sdk/react` client). Idiomatic Next 14, framework-native streaming, swappable provider abstraction. The trade-off is locking into the SDK's abstractions.

## Decision

Adopt the **Vercel AI SDK (v6)** as the streaming transport for Phase 3.

Server side: `streamText({ model: openai('gpt-4o'), messages, onFinish, onError })` inside `app/api/chat/route.ts`. The result is returned via `result.toUIMessageStreamResponse()`.

Client side: `useChat()` from `@ai-sdk/react`, wrapped by our own `useStreamingChat` hook (in `apps/web/src/features/chat/hooks/use-streaming-chat.ts`). The wrapper:

- Seeds messages from the server-loaded persisted history.
- Provides a request `transport` (`DefaultChatTransport`) that injects our `chatId` + flattens the AI SDK's `parts` array to plain `content` strings for the route handler.
- On `onFinish`, invalidates the relevant TanStack Query keys and calls `router.refresh()` so the sidebar (last-message-at, possibly newly-generated title) updates.

The `@magic-prompt/llm` package wraps the AI SDK behind a stable interface (`LLMProvider.generate` / `LLMProvider.stream`) so Phase 5+ multi-provider routing can swap implementations without touching the route handler.

## Consequences

**Positive**

- Streaming + reconnection are handled by the SDK; we own zero of the wire protocol.
- Adding Anthropic / Google providers in Phase 8 is `@ai-sdk/anthropic` + a small `AnthropicProvider` class — the route handler doesn't change.
- The client `useChat` hook gives us battle-tested optimistic-message state, abort handling, error boundaries.
- The route handler stays small: ~120 LOC for auth, validation, persistence, and the stream call.

**Negative**

- We're coupled to AI SDK abstractions. v5 → v6 already changed `LanguageModelUsage` (renamed `promptTokens` → `inputTokens`, etc.) and replaced `toDataStreamResponse()` with `toUIMessageStreamResponse()`. Future majors will hit us again.
- The UI-message stream format is opinionated — porting Phase 11's Edge migration may need a parallel data-stream protocol if Edge ergonomics improve.
- The provider object returned by `createOpenAI()` is callable in a way that types as `any` in our generic `LLMProvider` interface; we cast at the construction site only.

**Migration path (Phase 5+)**

The `LLMRouter` (`packages/llm/src/router.ts`) is currently a thin factory returning `OpenAIProvider`. When Phase 8 lands multi-provider routing, the router gets the actual routing logic and `OpenAIProvider` keeps its public surface. The chat route's call to `provider.stream(...)` doesn't change.
