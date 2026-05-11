-- Phase 3 — Chat enhancements: columns + index + trigger
--
-- Hand-written (drizzle-kit does not generate triggers or partial indexes).
-- Applied via the standard `pnpm --filter @magic-prompt/database db:migrate`
-- flow because the journal (`migrations/meta/_journal.json`) carries an
-- entry for it.
--
-- What this migration does:
--   1. Adds Phase 3 columns to `chats`: summary, last_message_at, is_archived, model.
--   2. Adds Phase 3 columns to `messages`: token_count, model, error,
--      parent_message_id (self-FK for future regenerate/branch), latency_ms.
--   3. Creates a partial index on `chats(user_id, last_message_at DESC)`
--      scoped to non-archived chats — the sidebar's primary access pattern.
--   4. Creates an index on `messages(parent_message_id)` for branch lookups.
--   5. Installs `public.bump_chat_last_message_at()` + `on_message_inserted`
--      trigger so every new message updates the parent chat's
--      `last_message_at` AND `updated_at`. SECURITY DEFINER so the trigger
--      can write to `chats` regardless of which role inserted the message.
--
-- RLS posture: existing Phase 2 policies cover the new columns automatically
-- (policies are row-level, not column-level). No new policies are needed.
-- Verified by `tooling/scripts/verify-chat-schema.ts` after this migration.
--
-- All operations are idempotent (use `IF NOT EXISTS`, `CREATE OR REPLACE`,
-- `DROP TRIGGER IF EXISTS`) so re-running is safe.

-- ---------------------------------------------------------------------------
-- 1. chats — Phase 3 columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS summary text NULL,
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS model varchar(64) NULL;

CREATE INDEX IF NOT EXISTS idx_chats_user_last_message
  ON public.chats (user_id, last_message_at DESC)
  WHERE is_archived = FALSE;

-- ---------------------------------------------------------------------------
-- 2. messages — Phase 3 columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS token_count integer NULL,
  ADD COLUMN IF NOT EXISTS model varchar(64) NULL,
  ADD COLUMN IF NOT EXISTS error text NULL,
  ADD COLUMN IF NOT EXISTS parent_message_id uuid NULL
    REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS latency_ms integer NULL;

CREATE INDEX IF NOT EXISTS idx_messages_parent
  ON public.messages (parent_message_id);

-- ---------------------------------------------------------------------------
-- 3. Trigger: auto-bump chats.last_message_at + updated_at on message insert
-- ---------------------------------------------------------------------------
-- Without this trigger, the sidebar (which sorts chats by last_message_at DESC)
-- would never see fresh entries. Doing it server-side keeps writers from
-- having to remember to bump the parent chat row.
--
-- SECURITY DEFINER + an explicit `SET search_path = public` are required for
-- triggers that mutate another table: PostgREST connects as `authenticated`,
-- which lacks UPDATE on chats unless RLS is satisfied. The trigger runs as
-- the function owner (postgres / the migration role) and bypasses RLS,
-- which is what we want here — the integrity of `last_message_at` is a
-- system invariant, not a user permission.

CREATE OR REPLACE FUNCTION public.bump_chat_last_message_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chats
     SET last_message_at = NEW.created_at,
         updated_at = NOW()
   WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_inserted ON public.messages;
CREATE TRIGGER on_message_inserted
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_chat_last_message_at();
