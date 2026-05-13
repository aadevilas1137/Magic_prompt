import 'server-only';

import { AppError, ErrorCode, type Chat, type UserId } from '@magic-prompt/shared';

import { createClient } from '@/lib/supabase/server';

export interface GetChatsOptions {
  readonly userId: UserId;
  readonly includeArchived?: boolean;
  readonly limit?: number;
  /** Cursor encoded as `<isoTimestamp>|<uuid>` — see `encodeCursor`. */
  readonly cursor?: string | null;
}

export interface GetChatsResult {
  readonly chats: readonly Chat[];
  readonly nextCursor: string | null;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * List the authenticated user's chats, sorted by `last_message_at DESC, id DESC`.
 *
 * Uses the **Supabase JS client** (RLS-enforced — the user JWT in cookies
 * restricts reads to rows where `auth.uid() = user_id` per `chats_select_own`).
 * The `userId` argument is for trace/log identification and as a defence-in-depth
 * filter; the database is the actual gate.
 *
 * Cursor format: opaque `<isoTimestamp>|<uuid>`. The composite sort
 * (`last_message_at`, then `id`) is necessary because two chats can share a
 * `last_message_at` value (the trigger uses `NEW.created_at` from messages).
 */
export async function getChats(opts: GetChatsOptions): Promise<GetChatsResult> {
  const limit = Math.min(Math.max(1, opts.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
  const supabase = createClient();

  let query = supabase
    .from('chats')
    .select(
      'id, user_id, title, summary, model, is_archived, last_message_at, created_at, updated_at',
    )
    .eq('user_id', opts.userId)
    .order('last_message_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  if (!opts.includeArchived) {
    query = query.eq('is_archived', false);
  }

  if (opts.cursor) {
    const decoded = decodeCursor(opts.cursor);
    // Compound cursor: lastMessageAt < cursorTimestamp,
    //   OR (lastMessageAt = cursorTimestamp AND id < cursorId)
    // Supabase JS doesn't expose tuple comparison ergonomically; we filter
    // by the timestamp first and let the second order tier handle ties.
    query = query.or(
      `last_message_at.lt.${decoded.lastMessageAt},and(last_message_at.eq.${decoded.lastMessageAt},id.lt.${decoded.id})`,
    );
  }

  const { data, error } = await query;
  if (error) {
    throw new AppError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Failed to load chats.',
      cause: error,
      metadata: { supabaseCode: error.code, userId: opts.userId },
    });
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const visible = hasMore ? rows.slice(0, limit) : rows;
  const chats: Chat[] = visible.map(rowToChat);
  const lastRow = hasMore ? visible[visible.length - 1] : null;
  const nextCursor = lastRow ? encodeCursor(lastRow.last_message_at, lastRow.id) : null;

  return { chats, nextCursor };
}

interface ChatRow {
  readonly id: string;
  readonly user_id: string;
  readonly title: string;
  readonly summary: string | null;
  readonly model: string | null;
  readonly is_archived: boolean;
  readonly last_message_at: string;
  readonly created_at: string;
  readonly updated_at: string;
}

function rowToChat(row: ChatRow): Chat {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    summary: row.summary,
    model: row.model,
    isArchived: row.is_archived,
    lastMessageAt: new Date(row.last_message_at),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function encodeCursor(lastMessageAt: string | Date, id: string): string {
  const ts = lastMessageAt instanceof Date ? lastMessageAt.toISOString() : lastMessageAt;
  return `${ts}|${id}`;
}

export function decodeCursor(cursor: string): { lastMessageAt: string; id: string } {
  const idx = cursor.lastIndexOf('|');
  if (idx < 0) {
    throw new AppError({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Invalid pagination cursor.',
    });
  }
  return {
    lastMessageAt: cursor.slice(0, idx),
    id: cursor.slice(idx + 1),
  };
}
