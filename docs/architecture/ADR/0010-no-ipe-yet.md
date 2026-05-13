# ADR-0010: Phase 3 ships direct LLM calls — IPE deferred to Phase 4

- **Status:** Accepted
- **Date:** 2026-05-11
- **Phase:** 3

## Context

The product premise is the **Input Prompt Engineering (IPE) pipeline**: take a user's raw input → classify domain + complexity → enrich into a "magic prompt" → call the LLM with the enriched prompt → return the (better) answer. That's the differentiator.

Phase 3 is the chat surface. The question was: ship IPE behind it now, or ship chat-first and slot IPE in later?

Two arguments competed:

- **IPE-first** — the moat lands earlier; users see the unique value from day one; the chat surface is a thin wrapper rather than a feature.
- **Chat-first** — visible product faster; team gets feedback loops; IPE can be developed against a real surface; chat UX problems (streaming, persistence, mobile, a11y) are solved before IPE complicates them.

## Decision

**Chat-first.** Phase 3 ships a working chat surface that calls OpenAI directly. Phase 4 introduces the IPE pipeline behind the existing surface.

The route handler at `apps/web/src/app/api/chat/route.ts` is the integration point. Today it:

1. Loads the last N persisted messages from the DB (`CHAT_CONTEXT_WINDOW`).
2. Builds an `LLMMessage[]` with a static system prompt (`SYSTEM_PROMPT` in `features/chat/lib/truncate-context.ts`).
3. Calls `OpenAIProvider.stream()`.

Phase 4 will swap step 2 for a pipeline call: `await runIPE({ userMessage, history })` → returns the enriched `LLMMessage[]`. **No UI changes. No route signature changes. No client-side hook changes.** Only the route's internal context-build step changes.

## Consequences

**Positive**

- The team can ship a usable chat product end-to-end in one phase. Demo-able. Iteratable.
- Streaming, persistence, mobile, accessibility — all the surface-side hard problems are solved separately from the IPE complexity.
- IPE quality is empirically validatable when it lands: A/B Phase 3's prompts vs Phase 4's enriched prompts on real conversations.
- The `prompt_logs` table sits idle through Phase 3 (no writes from this phase), giving Phase 4 a clean slate for telemetry.

**Negative**

- Marketing can't say "magic" until Phase 4 ships. Phase 3 demos as "yet another chat UI."
- The static system prompt in Phase 3 isn't great. Acceptable as a stand-in; will look obviously inferior next to Phase 4.
- Any chat surface tweaks that assume IPE shape (e.g. surfacing the magic prompt in a "show your work" UI) need to wait.

## Phase 4 plug-in checklist

When Phase 4 begins, the diff is mechanical:

1. Build `runIPE({ userMessage, history }): Promise<LLMMessage[]>` in `packages/ipe`.
2. Replace `buildLLMContext(...)` call in `app/api/chat/route.ts` with `await runIPE(...)`.
3. Write to `prompt_logs` from inside the IPE pipeline (service role; see `0007-rls-policy-design.md`).
4. Add a UI toggle (or quiet always-on) to surface the enriched prompt in dev — this is a Phase 4 design decision, not a Phase 3 placeholder.

No DB migration required; the `messages` and `chats` schemas are stable through Phase 4. `prompt_logs` already exists from Phase 1.

## Alternatives considered

- **IPE-first** — rejected. The team estimated a 4-6 week IPE phase. Shipping nothing visible for that long is operationally and motivationally costly.
- **Half-pipe IPE in Phase 3** — rejected. Splitting the IPE pipeline across two phases means twice the integration complexity (the chat route would have to handle both old and new context shapes during the transition).
