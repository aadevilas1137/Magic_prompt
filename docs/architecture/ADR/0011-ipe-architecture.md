# ADR-0011: IPE — 5-layer pipeline architecture

- **Status:** Accepted
- **Date:** 2026-05-13
- **Phase:** 4

## Context

The product premise is that **Magic Prompt AI is invisible prompt engineering** — the user types a lazy request ("create real estate website"), and the system silently transforms it into an expert-grade prompt before calling the LLM. The user never sees the magic prompt; they just see a noticeably better response than a vanilla ChatGPT wrapper would produce.

Phase 3 shipped the chat surface with a static system prompt (the integration seam was a single function call in `/api/chat`). Phase 4 introduces the actual pipeline — the competitive moat.

The pipeline has to be:

1. **Fast enough that the user can't tell** — Layers 1-3 cumulative <1.5s before the LLM stream starts.
2. **Reliable enough to ship** — any layer failure must fall back to the Phase 3 path so users still get a response.
3. **Observable enough to debug + improve** — every transformation is logged to `prompt_logs` for offline analysis.
4. **Invisible** — the magic prompt MUST NOT leak to the user via response content, error messages, or HTTP headers. The only surface that ever sees it is the admin-gated `?showMagic=1` debug panel.

## Decision

A **5-layer sequential pipeline**, implemented as the `@magic-prompt/ipe` package:

| Layer                        | Purpose                                                              | Implementation                                          | Latency budget |
| ---------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------- | -------------- |
| 1 — Intent Parser            | Extract structured intent from natural language                      | `gpt-4o-mini` with JSON mode + Zod validation + 1 retry | ~300-500ms     |
| 2 — Domain Classifier        | Pick a domain + complexity tier from a fixed enum                    | `gpt-4o-mini` with constrained JSON output              | ~300-500ms     |
| 3 — Magic Prompt Constructor | Build the 4-part magic prompt (Context / Task / Instructions / Data) | Template-based, pure code, slot-filling                 | <50ms          |
| 4 — LLM Router               | Send to the LLM, stream tokens                                       | Wraps `@magic-prompt/llm` `OpenAIProvider`              | (streams)      |
| 5 — Quality Validator        | Score quality, sample LLM-as-judge, write `prompt_logs` row          | Heuristic + 10% LLM judge, async after stream           | (post-stream)  |

Layers 1+2 are LLM-based for flexibility; Layer 3 is template-based because deterministic prompt construction beats LLM-based for repeatability and latency. Phase 6+ may revisit Layer 3 if templates plateau on quality.

### Why LLM-as-classifier over embeddings

Embedding-based classification is faster and cheaper at inference time (~50ms vs 500ms) but requires:

- A labelled training corpus we don't have yet.
- A retraining pipeline when domains expand (Phase 6+ goes from 10 to 20+).
- Hosting infrastructure for the embedding service.

For Phase 4 the LLM classifier ships immediately, gives us labelled telemetry (`prompt_logs.classifier_json`) we can use to bootstrap an embedding model later, and the latency budget tolerates it (we're already calling the LLM for streaming).

Phase 7's "personalisation + caching" phase will replace Layer 2 with an embedding-based classifier trained on the accumulated `prompt_logs`.

### Why template-based Layer 3 over LLM-based

Two reasons:

1. **Latency:** Layers 1+2 already burn ~1s. Adding a Layer 3 LLM call would push past the 1.5s budget that keeps the surface feeling "instant".
2. **Determinism:** Domain experts can review and edit templates directly. An LLM-generated prompt is a moving target; a template is auditable.

The trade-off: domain coverage is bounded by the templates we hand-write. Phase 4 ships 10 templates (`web_development`, `real_estate`, `content_writing`, `marketing`, `data_analysis`, `education`, `legal`, `healthcare`, `hr`, `general`). Phase 6+ expands to 20+.

### Why sequential L1→L2→L3 (no parallelisation)

Layer 2 needs Layer 1's `intent` to do its job well — they're naturally sequential. Parallelising L1+L2 (running them on the raw user message simultaneously) loses 10-15% classifier accuracy in early tests, and the latency saving (~300ms) isn't worth that. Phase 11 (latency-optimisation phase) may revisit if budgets tighten.

### Fallback strategy

Two flags govern resilience:

- `IPE_ENABLED` (default false) — master switch. When false, `/api/chat` behaves identically to Phase 3.
- `IPE_FALLBACK_ON_ERROR` (default true) — if the pipeline throws, fall back to the Phase 3 raw-LLM path so the user still gets a response.

Layer-internal failures (timeout, parse failure, retry exhaustion) DON'T propagate — each layer returns a `fallbackUsed: true` default shape and the pipeline continues. Only programming errors / config errors throw.

## Consequences

**Positive**

- Ships the moat with one-line `/api/chat` integration (the rest is library code in `@magic-prompt/ipe`).
- The 5-layer split lets us iterate on each layer independently — improve the classifier without touching templates, improve templates without touching the classifier.
- The `prompt_logs` table accumulates training data for Phase 7+ embedding classifier.
- `IPE_ENABLED=false` is a complete kill-switch — production rollouts can A/B safely.
- LLM-as-judge sampling (10% of responses) gives us a continuous quality signal without burning 100% of judge tokens.

**Negative**

- Adds ~1.5s to the time-to-first-token on every chat send. Acceptable for the quality lift but not great for short-form chats. Phase 11 caching addresses.
- Two extra LLM calls per turn (intent + classifier, both `gpt-4o-mini`) ≈ $0.0003/turn at current rates. Material at scale; Phase 11 caching + Phase 7 embeddings reduce.
- Template maintenance becomes a thing — 10 templates × 3 complexity tiers × evolution over time.
- Magic-prompt-leakage is a forever-rule, not just a Phase 4 concern. Every future feature has to be reviewed for it.

## Alternatives considered

- **Pure LLM-based pipeline** (every layer is an LLM call). Rejected: ~3s cumulative latency, $0.001+/turn, less debuggable.
- **Pure rule-based pipeline** (no LLM in IPE). Rejected: can't generalise across domains, brittle to lazy-input variation.
- **Single-LLM-call "rewrite this prompt" pattern**. Rejected: gives up domain-specific persona + quality-bar guidance, harder to A/B against the baseline.
- **External orchestration framework (LangChain, LangGraph)**. Rejected: pulls in heavy dependencies for an inverted-of-control pattern we don't need; 5 sequential calls don't justify a graph engine.
