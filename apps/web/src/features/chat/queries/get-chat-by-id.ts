import 'server-only';

import { AppError, ErrorCode, type Chat, type ChatId, type UserId } from '@magic-prompt/shared';

import { createClient } from '@/lib/supabase/server';

export interface GetChatByIdOptions {
  readonly userId: UserId;
  readonly chatId: ChatId;
}

/**
 * Load a single chat by id. Returns `null` when:
 *   - the chat doesn't exist, OR
 *   - RLS blocks the read (i.e. the row belongs to a different user)
 * Both produce a single "not yours" outcome from the caller's perspective
 * (no email-style enumeration on chat ids).
 */
export async function getChatById(opts: GetChatByIdOptions): Promise<Chat | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('chats')
    .select(
      'id, user_id, title, summary, model, is_archived, last_message_at, created_at, updated_at',
    )
    .eq('id', opts.chatId)
    .eq('user_id', opts.userId)
    .maybeSingle();

  if (error) {
    throw new AppError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Failed to load chat.',
      cause: error,
      metadata: { supabaseCode: error.code, chatId: opts.chatId },
    });
  }
  if (!data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    title: data.title,
    summary: data.summary,
    model: data.model,
    isArchived: data.is_archived,
    lastMessageAt: new Date(data.last_message_at),
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}
