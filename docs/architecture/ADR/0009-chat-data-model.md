# ADR-0009: Chat persistence — data model + write semantics

- **Status:** Accepted
- **Date:** 2026-05-11
- **Phase:** 3

## Context

Phase 3 persists chats and messages so users can resume conversations across sessions. The Phase 1 schema had a minimal `chats` (id, user_id, title, timestamps) + `messages` (id, chat_id, role, content, created_at). Phase 3 added the production columns.

The data model needed to answer four questions in O(few ms):

1. **List chats for a user, sorted by recency** — sidebar's primary query.
2. **Resume a chat** — load the most recent messages for one chat id.
3. **Track LLM cost** — token counts + model per message.
4. **Surface partial failures** — when a stream errors mid-flight, keep the user's message and mark the assistant turn as errored.

## Decision

Migration `0002_chat_enhancements.sql` adds the following:

### `chats` additions

| Column            | Type                               | Why                                                                   |
| ----------------- | ---------------------------------- | --------------------------------------------------------------------- |
| `summary`         | text NULL                          | Phase 6+ summarisation slot. Reserved now to avoid a later migration. |
| `last_message_at` | timestamptz NOT NULL DEFAULT NOW() | Sidebar sort key — must be stamped on every message insert.           |
| `is_archived`     | boolean NOT NULL DEFAULT FALSE     | Soft delete pattern; archived chats are hidden but restorable.        |
| `model`           | varchar(64) NULL                   | Last model used in this chat — surfaces in resume UX hints.           |

Partial index: `idx_chats_user_last_message ON chats(user_id, last_message_at DESC) WHERE is_archived = FALSE`. Phase 3's sidebar query (`WHERE user_id = ? AND is_archived = FALSE ORDER BY last_message_at DESC`) is an index-only scan.

### `messages` additions

| Column              | Type                                           | Why                                                                    |
| ------------------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| `token_count`       | integer NULL                                   | Completion-side token count from the LLM response; cost tracking.      |
| `model`             | varchar(64) NULL                               | Concrete model used for this turn (gpt-4o, gpt-4o-mini, …).            |
| `error`             | text NULL                                      | If set, this turn failed mid-stream; UI shows retry CTA.               |
| `parent_message_id` | uuid NULL FK → messages(id) ON DELETE SET NULL | Self-FK for Phase 6+ branch / regenerate semantics. Always NULL today. |
| `latency_ms`        | integer NULL                                   | First-token-to-finish latency. Cost + performance telemetry.           |

Index `idx_messages_parent ON messages(parent_message_id)` for future branch lookups.

### Trigger: `on_message_inserted`

`AFTER INSERT ON messages` calls `bump_chat_last_message_at()` which sets `chats.last_message_at = NEW.created_at` and `chats.updated_at = NOW()` for the parent chat. The function is `SECURITY DEFINER` so triggers fire regardless of the inserting role's RLS policies — this is a system invariant, not a user permission decision.

### Write path

`/api/chat`'s sequence:

1. Persist the **user message first**. If the LLM call fails, the user's input is still in the DB and can be retried.
2. Stream the assistant response via `streamText`. The `onFinish` callback persists the assistant message with `token_count`, `model`, `latency_ms` + stamps `chats.model`.
3. On `onError`, persist an assistant row with `error` set and `content = ''` (partial content is dropped — the UI doesn't show truncated half-thoughts, only "retry").

### RLS posture

Phase 2's row-level policies cover the new columns automatically — policies are row-scoped, not column-scoped. No new policies needed. `tooling/scripts/verify-chat-schema.ts` confirms RLS still blocks anon access post-migration.

## Consequences

**Positive**

- Sidebar query is O(log n) with the partial index, even for users with thousands of chats.
- Cost telemetry (`token_count`, `model`, `latency_ms`) lives on the message; Phase 8 cost dashboard plugs in without re-engineering writes.
- Partial-failure surface (`error` column) keeps mid-stream errors recoverable — the user's message survives.
- `parent_message_id` is reserved now; Phase 6+ regenerate doesn't need another migration.

**Negative**

- Drizzle migrations don't generate triggers / partial indexes; the `0002` migration is hand-written, with `idempotent` guards (`CREATE INDEX IF NOT EXISTS`, etc.) so re-runs are safe.
- The `SECURITY DEFINER` trigger means a malicious user-row insert can't drift `chats.last_message_at` via RLS — but it _can_ via direct app-layer writes if a future bug lets one insert a message into another user's chat. The chat-route + server actions defend against this with explicit `user_id` filters. The trigger doesn't protect against application bugs; RLS on `messages` (the join-via-chats policy) does.
- `model` (varchar(64)) caps model names at 64 chars. Adequate for known model ids (`gpt-4o`, `claude-3-5-sonnet-20241022`); revisit if provider naming gets longer.

## Alternatives considered

- **Separate `chat_state` table for `last_message_at`** — would have avoided the trigger but added a join to every sidebar query. The trigger is one statement of plpgsql; the join would have run on every read.
- **Computed column** for `last_message_at` via `MAX(messages.created_at)` — clean conceptually but Postgres doesn't support materialised computed columns without rewriting; we'd be back to triggers anyway.
