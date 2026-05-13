import 'server-only';

import {
  AppError,
  ErrorCode,
  type ChatId,
  type Message,
  type MessageRole,
  type UserId,
} from '@magic-prompt/shared';

import { createClient } from '@/lib/supabase/server';

export interface GetMessagesOptions {
  readonly userId: UserId;
  readonly chatId: ChatId;
  readonly limit?: number;
}

export interface GetMessagesResult {
  readonly messages: readonly Message[];
}

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

/**
 * Load messages for a chat in chronological order (oldest → newest).
 *
 * RLS is enforced via the chat join: `messages_select_own` checks
 * `EXISTS (SELECT 1 FROM chats WHERE id = messages.chat_id AND user_id = auth.uid())`.
 * If the caller doesn't own the chat, this returns an empty array
 * (Supabase returns `[]` rather than an error for RLS-blocked rows).
 *
 * Phase 3 deliberately loads the whole chat at once (no pagination). 200
 * messages × ~500 bytes each = 100KB JSON, well within payload budgets.
 * Phase 6+ introduces infinite scroll over older messages.
 */
export async function getMessages(opts: GetMessagesOptions): Promise<GetMessagesResult> {
  const limit = Math.min(Math.max(1, opts.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
  const supabase = createClient();

  // Verify ownership separately (cheap, also makes the empty-result path
  // distinguishable from "no messages yet").
  const { data: chat, error: chatErr } = await supabase
    .from('chats')
    .select('id')
    .eq('id', opts.chatId)
    .eq('user_id', opts.userId)
    .maybeSingle();
  if (chatErr) {
    throw new AppError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Failed to verify chat access.',
      cause: chatErr,
      metadata: { chatId: opts.chatId },
    });
  }
  if (!chat) {
    throw new AppError({
      code: ErrorCode.NOT_FOUND,
      message: 'Chat not found.',
      metadata: { chatId: opts.chatId },
    });
  }

  const { data, error } = await supabase
    .from('messages')
    .select(
      'id, chat_id, role, content, token_count, model, error, parent_message_id, latency_ms, created_at',
    )
    .eq('chat_id', opts.chatId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(limit);

  if (error) {
    throw new AppError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Failed to load messages.',
      cause: error,
      metadata: { chatId: opts.chatId },
    });
  }

  const messages: Message[] = (data ?? []).map((row) => ({
    id: row.id,
    chatId: row.chat_id,
    role: row.role as MessageRole,
    content: row.content,
    tokenCount: row.token_count,
    model: row.model,
    error: row.error,
    parentMessageId: row.parent_message_id,
    latencyMs: row.latency_ms,
    createdAt: new Date(row.created_at),
  }));

  return { messages };
}
