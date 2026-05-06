-- Phase 2 — Auth setup: trigger + RLS
--
-- This migration was hand-written (drizzle-kit does not generate triggers,
-- functions, or RLS policies). Applied via the standard
-- `pnpm --filter @magic-prompt/database db:migrate` flow because the journal
-- (`migrations/meta/_journal.json`) carries an entry for it.
--
-- What this migration does:
--   1. `handle_new_user()` + `on_auth_user_created` trigger — every row
--      inserted into `auth.users` gets a mirrored row in `public.users` with
--      the same id and email.
--   2. Row-level security on all four `public` tables (`users`, `chats`,
--      `messages`, `prompt_logs`) with policies that scope reads/writes to
--      the authenticated owner and lock `prompt_logs` to service role only.
--
-- All operations are idempotent (use `CREATE OR REPLACE`, `IF NOT EXISTS`,
-- and `DROP POLICY IF EXISTS` so re-running is safe in a recovery scenario.

-- ---------------------------------------------------------------------------
-- 1. Trigger: keep public.users in sync with auth.users
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. Enable RLS on all public tables
-- ---------------------------------------------------------------------------

ALTER TABLE public.users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_logs  ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners (defense in depth — the role we connect
-- as via PostgREST is `authenticated`/`anon`, never the table owner, but
-- this guards against accidental privileged connections).
ALTER TABLE public.users        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.chats        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.messages     FORCE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_logs  FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. Policies: public.users
-- ---------------------------------------------------------------------------
-- A user can read and update only their own row. Inserts come exclusively
-- from the trigger above (which runs as `SECURITY DEFINER` and bypasses RLS),
-- so no INSERT policy is needed. Deletes are denied entirely.

DROP POLICY IF EXISTS users_select_self ON public.users;
CREATE POLICY users_select_self
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS users_update_self ON public.users;
CREATE POLICY users_update_self
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 4. Policies: public.chats
-- ---------------------------------------------------------------------------
-- A user owns chats they created. CRUD is allowed only on their own rows.

DROP POLICY IF EXISTS chats_select_own ON public.chats;
CREATE POLICY chats_select_own
  ON public.chats
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS chats_insert_own ON public.chats;
CREATE POLICY chats_insert_own
  ON public.chats
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS chats_update_own ON public.chats;
CREATE POLICY chats_update_own
  ON public.chats
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS chats_delete_own ON public.chats;
CREATE POLICY chats_delete_own
  ON public.chats
  FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. Policies: public.messages
-- ---------------------------------------------------------------------------
-- Messages are owned transitively through their chat. Updates are denied
-- (messages are immutable in the product). Deletes follow chat ownership.

DROP POLICY IF EXISTS messages_select_own ON public.messages;
CREATE POLICY messages_select_own
  ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = messages.chat_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS messages_insert_own ON public.messages;
CREATE POLICY messages_insert_own
  ON public.messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = messages.chat_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS messages_delete_own ON public.messages;
CREATE POLICY messages_delete_own
  ON public.messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = messages.chat_id
        AND c.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Policies: public.prompt_logs (INTERNAL — no client access)
-- ---------------------------------------------------------------------------
-- This table holds raw IPE telemetry. Service role bypasses RLS by default
-- (the server uses it for internal logging). For everyone else — including
-- authenticated users — every action is denied. Note we deliberately add
-- explicit deny-all policies for SELECT/INSERT/UPDATE/DELETE rather than
-- relying on "no policy = deny all" so the intent is auditable.

COMMENT ON TABLE public.prompt_logs IS
  'Internal-only IPE telemetry. No client access. Service role only.';

DROP POLICY IF EXISTS prompt_logs_deny_all ON public.prompt_logs;
CREATE POLICY prompt_logs_deny_all
  ON public.prompt_logs
  AS RESTRICTIVE
  FOR ALL
  USING (false)
  WITH CHECK (false);
