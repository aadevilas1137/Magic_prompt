# ADR-0013: IPE feature flags + rollout strategy

- **Status:** Accepted
- **Date:** 2026-05-13
- **Phase:** 4

## Context

Phase 4 ships the competitive moat. It's also the highest-risk launch we've made:

- **Latency:** adds ~1.5s to time-to-first-token.
- **Cost:** two extra LLM calls per turn (~$0.0003/turn at current rates).
- **Quality:** if a domain template is broken, every user hitting that domain gets a worse response than they would have with the Phase 3 raw path.
- **Invisibility:** any prompt leakage is a "the magic is gone" failure mode that's hard to detect from analytics alone.

We need a graduated rollout strategy + a kill-switch we can flip without a deploy.

## Decision

Three feature flags expose the dial:

### `IPE_ENABLED` (default `false`)

Master switch. When `false`, `/api/chat` behaves identically to Phase 3 (raw LLM, static system prompt). When `true`, the pipeline runs.

**Rollout plan** (post-merge):

1. **Internal-only:** `IPE_ENABLED=true` in dev `.env.local` for the project owner. Run the manual 20-input benchmark.
2. **10% A/B:** wire a feature-flag rule in the application layer (Phase 4.5 follow-up if rollout decision is made) so 10% of users get IPE.
3. **50% A/B:** after a week of monitoring `prompt_logs` for quality regressions + leakage signals.
4. **100%:** after another week of clean signal.

The flag is checked per-request inside the route handler, so flipping it changes behaviour immediately without a deploy.

### `IPE_FALLBACK_ON_ERROR` (default `true`)

If `runIPE()` throws (config error, unexpected programming bug — NOT a layer-internal fallback), the route handler falls back to the Phase 3 raw-LLM path. The user gets a response; the error is logged + the `ipe.pipeline.fallback` PostHog event fires.

We default this `true` because users getting a slightly-worse response is far better than a 500.

Set to `false` only when actively debugging pipeline failures (you want the stack trace to bubble up).

### `IPE_DEBUG_MODE` (default `false`)

Master switch for the `?showMagic=1` debug panel. Even with this on, the page also runs `isIPEAdmin(user.email)` — both must pass for the panel to render. So flipping `IPE_DEBUG_MODE=true` in production without adding emails to `IPE_ADMIN_EMAILS` is safe.

### `IPE_ADMIN_EMAILS` (default `aadevilasrao1137@gmail.com`)

Comma-separated email list. The Zod-validated env transforms this to a lowercased string array. `isIPEAdmin()` checks the authenticated user's email against this list.

Phase 8 RBAC will replace this hardcoded list with a real role check (`admins` table, JWT claim, or Supabase RPC).

### Tuning flags

- `IPE_INTENT_TIMEOUT_MS` / `IPE_CLASSIFIER_TIMEOUT_MS` — per-layer `p-timeout` budget. Defaults 2000ms each (generous for `gpt-4o-mini`).
- `IPE_QUALITY_SAMPLE_RATE` — Layer 5 LLM-as-judge sample rate. Default 0.1 (10%); range 0-1. Set to 0 to disable judge entirely.
- `IPE_PIPELINE_VERSION` — schema version stamped on every `prompt_logs` row. Bump on architecture changes so the analytics queries can filter cohorts.

## Why all flags default off / safe

The Phase 3 surface is the established baseline. Turning IPE on is a deliberate, observable change. Defaults-off means a deploy with un-set env vars cannot accidentally enable the moat.

The exception is `IPE_FALLBACK_ON_ERROR=true` (default on) — fallback is the safe behaviour for users, even though it costs us pipeline observability when it fires.

## Monitoring + signals

While IPE is rolling out, watch:

| Signal                          | Source                                                         | Healthy range           |
| ------------------------------- | -------------------------------------------------------------- | ----------------------- |
| Cumulative L1+L2+L3 latency p95 | PostHog `ipe.pipeline.completed.totalLatencyMs`                | < 1500ms                |
| Layer 2 low-confidence rate     | PostHog `ipe.layer2.low_confidence` / `ipe.pipeline.completed` | < 15%                   |
| Fallback rate                   | PostHog `ipe.pipeline.fallback` / `ipe.pipeline.started`       | < 1%                    |
| Leakage rate                    | `prompt_logs` query: COUNT where heuristic flagged leakage     | 0 (any > 0 is a P0 fix) |
| Heuristic quality score p50     | `prompt_logs.quality_score` aggregate                          | > 70                    |
| Cost per chat                   | PostHog token counts + OpenAI dashboard                        | < $0.001/turn           |

Set alerts on `fallback_rate > 5%` and `leakage_count > 0` once the production PostHog + Sentry are wired (Phase 4 R&D research item).

## Rollback procedure

If something goes wrong after rollout:

1. Set `IPE_ENABLED=false` in Vercel env vars. Save. (Takes effect on the next request — no deploy needed.)
2. Verify chats work via the Phase 3 path.
3. Investigate the `prompt_logs` rows and `ipe.pipeline.failed` PostHog events to identify the bug.
4. Ship a fix in a follow-up PR, re-enable the flag.

The fact that this rollback takes <1 minute is the entire point of the flag.

## Consequences

**Positive**

- Zero-risk rollout — the kill switch is one env var.
- Multiple independent dials let us tune cost vs quality vs latency without touching code.
- Admin gate is enforced server-side, defence-in-depth with `IPE_DEBUG_MODE`.

**Negative**

- Six new env vars (one required behaviour, five tuning). Documented in `apps/web/.env.example`; new deployers need to read it.
- The flag checks add a tiny bit of branching complexity to `/api/chat`. Worth it.

## Alternatives considered

- **Single `IPE_ENABLED` flag only** — rejected. The fallback + debug behaviours need independent control.
- **Build-time flag (replace at deploy)** — rejected. Want runtime toggle for fast rollback.
- **Per-user feature flag via PostHog flags** — deferred. Useful for the 10% / 50% A/B steps but not blocking Phase 4 ship; PostHog flags can layer on top of `IPE_ENABLED` later.
