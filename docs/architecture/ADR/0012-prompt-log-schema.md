# ADR-0012: `prompt_logs` schema for IPE telemetry

- **Status:** Accepted
- **Date:** 2026-05-13
- **Phase:** 4 (extends Phase 1 stub)

## Context

`prompt_logs` is the table that captures every IPE pipeline run for offline analysis. Phase 1 created the table as a stub with placeholder columns (`domain`, `complexity`, `quality_score real`, `llm_used`); Phase 4 promotes it to the real telemetry surface that drives:

- **Phase 7 personalisation** — embedding training data, per-user style preferences.
- **Quality monitoring** — domain-level quality score trends, fallback rate, latency regression alerts.
- **Cost accounting** — per-domain token usage, model-mix analysis.
- **Internal debugging** — the `?showMagic=1` admin panel reads from this table.

The trade-off: this table contains the most sensitive data we hold (the user's verbatim original input + the full constructed magic prompt). RLS posture has to be airtight, schema has to support both flexible analytics and queryable filters.

## Decision

### Columns added in migration `0003_ipe_pipeline.sql`

| Column               | Type                                | Purpose                                                                  |
| -------------------- | ----------------------------------- | ------------------------------------------------------------------------ |
| `chat_id`            | uuid NULL FK → chats(id) CASCADE    | Trace back to the chat. Cascade so deleted chats remove their telemetry. |
| `message_id`         | uuid NULL FK → messages(id) CASCADE | Trace back to the specific message that triggered the pipeline.          |
| `intent_json`        | jsonb                               | Layer 1 output — full IntentParserResult.                                |
| `classifier_json`    | jsonb                               | Layer 2 output — full ClassifierResult.                                  |
| `primary_domain`     | varchar(64)                         | Queryable copy of `classifier_json.primary_domain`. Indexed.             |
| `secondary_domain`   | varchar(64) NULL                    | Queryable copy.                                                          |
| `complexity_score`   | varchar(16)                         | 'simple' \| 'moderate' \| 'expert'. Indexed.                             |
| `layer_latencies_ms` | jsonb                               | `{ layer1, layer2, layer3 }`. Drives latency-regression dashboards.      |
| `quality_score`      | integer NULL                        | Layer 5 score 0-100. Indexed (partial: WHERE quality_score IS NOT NULL). |
| `quality_method`     | varchar(32)                         | 'heuristic' \| 'llm_judge'.                                              |
| `fallback_used`      | boolean NOT NULL DEFAULT FALSE      | Indexed (partial: WHERE fallback_used = TRUE).                           |
| `error`              | text NULL                           | Error message if pipeline crashed; null on success.                      |
| `pipeline_version`   | varchar(16) NOT NULL DEFAULT 'v1'   | Schema version stamp.                                                    |

### Why hybrid flat columns + jsonb

We could have stored everything in a single `metadata jsonb` column and called it a day. We didn't because:

- **Queryable filters** like "all expert real-estate responses with quality < 50 in the last 7 days" need the filterable fields to be flat columns + indexed. Postgres can index jsonb subkeys (GIN indexes) but the query syntax is uglier and the planner sometimes picks worse plans.
- **Type discipline** — the flat columns are typed via Drizzle; the jsonb columns are typed via Zod at the application layer (`@magic-prompt/ipe/src/types.ts`).

The duplication between `classifier_json.primary_domain` (jsonb) and `primary_domain` (flat varchar) is intentional: the jsonb preserves the full record (including `confidence`, `reasoning`), the flat column gives us O(log n) filtering.

### Indexes

| Index                                                                     | Purpose                                                                                     |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `idx_prompt_logs_user_created (user_id, created_at DESC)`                 | Per-user timeline. Drives the admin panel and Phase 7 personalisation queries.              |
| `idx_prompt_logs_domain (primary_domain)`                                 | Per-domain quality dashboards.                                                              |
| `idx_prompt_logs_complexity (complexity_score)`                           | Complexity distribution analysis.                                                           |
| `idx_prompt_logs_quality (quality_score) WHERE quality_score IS NOT NULL` | Partial index for low-quality drilldown.                                                    |
| `idx_prompt_logs_fallback (fallback_used) WHERE fallback_used = TRUE`     | Partial index for fallback-rate monitoring (most rows are FALSE, so a partial saves space). |

### Phase 1 legacy columns

`domain` (text), `complexity` (integer), `llm_used` (text) all became nullable. They remain because:

- Nullable columns cost nothing in Postgres.
- A future migration may want to backfill from them.
- The Drizzle schema still exports them, keeping any external readers stable.

`quality_score` was `real` in Phase 1 and changed to `integer` in Phase 4 (the table was empty, so the type change is safe). Documented as Phase 4 deviation in PHASE_4_REPORT.md.

### Service-role write path

`prompt_logs` has a `RESTRICTIVE` deny-all RLS policy from Phase 2 ([`ADR-0007`](0007-rls-policy-design.md)). The IPE pipeline writes via the SAME Drizzle connection the chat path uses (postgres-js → DATABASE_URL → transaction pooler), which connects as a role exempt from the deny-all because Drizzle bypasses PostgREST entirely.

In Phase 8 we'll introduce a dedicated `service_role` Postgres role with explicit grants on `prompt_logs`. Until then, the practical security boundary is:

- The file `@magic-prompt/ipe/src/lib/service-role-db.ts` has `'server-only'` import at the top.
- Only `@magic-prompt/ipe/src/pipeline.ts` (server-only) imports it.
- The IPE pipeline only runs from `/api/chat` (server-only route handler).
- There is no client-readable code path that produces a service-role connection.

### Phase 8 admin read access

The `?showMagic=1` debug panel needs to read `prompt_logs` for a single chat — that path currently uses the same Drizzle handle (effectively service-role). Phase 8 RBAC will move this behind a real role check with a dedicated read-only role.

## Consequences

**Positive**

- All Phase 4 analytics queries hit indexed columns.
- jsonb preserves the full classifier/intent records for forensics + future ML training.
- Cascade FKs to chats/messages keep the table tidy on deletes.
- Fallback rate monitoring is cheap (partial index).

**Negative**

- 13 new columns is a lot. Schema-level discoverability suffers; mitigated by the typed Drizzle schema + this ADR.
- `prompt_logs` is now the most sensitive table — review every code path that touches it.
- `quality_score` type flip (`real` → `integer`) is a one-way migration; documented but unrevisitable without data loss (table was empty so this is academic).

## Verification

`tooling/scripts/verify-ipe-schema.ts` checks the migration applied correctly + RLS still blocks anon reads + service-role write path round-trips. Run on every deploy that touches this table.
