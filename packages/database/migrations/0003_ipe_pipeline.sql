-- Phase 4 — IPE pipeline schema extensions
--
-- Expands `prompt_logs` (Phase 1 stub) with the Phase 4 IPE telemetry columns.
-- The table is internal-only (service-role writes, RLS deny-all from Phase 2);
-- this migration does NOT change RLS posture. Verified post-migration by
-- `tooling/scripts/verify-ipe-schema.ts`.
--
-- All operations are idempotent (`IF NOT EXISTS`, `DROP COLUMN IF EXISTS`,
-- `DROP NOT NULL` is naturally idempotent) so re-runs are safe.
--
-- Sequence:
--   1. Drop the legacy `quality_score real` (Phase 1 stub, no data). Re-added
--      below as `integer NULL` per Phase 4 spec.
--   2. Make legacy stub columns (`domain`, `complexity`, `llm_used`) nullable.
--      Phase 4 IPE writes populate the new `primary_domain`, `complexity_score`,
--      etc. instead; legacy columns are kept for forward compat but no longer
--      required.
--   3. Add Phase 4 columns: chat_id, message_id, intent_json, classifier_json,
--      primary_domain, secondary_domain, complexity_score, layer_latencies_ms,
--      quality_score (integer), quality_method, fallback_used, error,
--      pipeline_version.
--   4. Indexes for the analytics queries (per-user timeline, per-domain
--      aggregate, complexity distribution, low-quality drilldown,
--      fallback-rate monitoring).
--   5. Refresh the table comment to make the deny-all RLS posture explicit.

-- ---------------------------------------------------------------------------
-- 1. Drop legacy quality_score (real) — Phase 1 stub, no rows ever written
-- ---------------------------------------------------------------------------

ALTER TABLE public.prompt_logs DROP COLUMN IF EXISTS quality_score;

-- ---------------------------------------------------------------------------
-- 2. Relax NOT NULL on legacy stub columns
-- ---------------------------------------------------------------------------
-- IPE writes populate `primary_domain` / `complexity_score` instead of the
-- Phase 1 placeholders. Keep the legacy columns around in case a future
-- migration wants to backfill from them; just don't require them on insert.

ALTER TABLE public.prompt_logs ALTER COLUMN domain DROP NOT NULL;
ALTER TABLE public.prompt_logs ALTER COLUMN complexity DROP NOT NULL;
ALTER TABLE public.prompt_logs ALTER COLUMN llm_used DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Phase 4 IPE columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.prompt_logs
  ADD COLUMN IF NOT EXISTS chat_id uuid NULL
    REFERENCES public.chats(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS message_id uuid NULL
    REFERENCES public.messages(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS intent_json jsonb NULL,
  ADD COLUMN IF NOT EXISTS classifier_json jsonb NULL,
  ADD COLUMN IF NOT EXISTS primary_domain varchar(64) NULL,
  ADD COLUMN IF NOT EXISTS secondary_domain varchar(64) NULL,
  ADD COLUMN IF NOT EXISTS complexity_score varchar(16) NULL,
  ADD COLUMN IF NOT EXISTS layer_latencies_ms jsonb NULL,
  ADD COLUMN IF NOT EXISTS quality_score integer NULL,
  ADD COLUMN IF NOT EXISTS quality_method varchar(32) NULL,
  ADD COLUMN IF NOT EXISTS fallback_used boolean NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS error text NULL,
  ADD COLUMN IF NOT EXISTS pipeline_version varchar(16) NOT NULL DEFAULT 'v1';

-- ---------------------------------------------------------------------------
-- 4. Indexes for analytics queries
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_prompt_logs_user_created
  ON public.prompt_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prompt_logs_domain
  ON public.prompt_logs (primary_domain);

CREATE INDEX IF NOT EXISTS idx_prompt_logs_complexity
  ON public.prompt_logs (complexity_score);

CREATE INDEX IF NOT EXISTS idx_prompt_logs_quality
  ON public.prompt_logs (quality_score) WHERE quality_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prompt_logs_fallback
  ON public.prompt_logs (fallback_used) WHERE fallback_used = TRUE;

-- ---------------------------------------------------------------------------
-- 5. Table comment — explicit internal-only marker
-- ---------------------------------------------------------------------------

COMMENT ON TABLE public.prompt_logs IS
  'INTERNAL ONLY — IPE pipeline telemetry (Phase 4+). Service-role writes only. Client reads DENIED via Phase 2 RESTRICTIVE RLS policy. Phase 8 RBAC will introduce admin-scoped reads.';
