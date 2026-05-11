import 'server-only';

import { AppError, ErrorCode, type UserId } from '@magic-prompt/shared';

import { createClient } from '@/lib/supabase/server';

export interface ChatStats {
  readonly totalChats: number;
  readonly archivedChats: number;
}

/**
 * Lightweight aggregate counts for the sidebar (e.g. "12 chats"). Uses
 * `head: true` + `count: 'exact'` so the response body is empty and only
 * the count column comes back over the wire.
 */
export async function getChatStats(userId: UserId): Promise<ChatStats> {
  const supabase = createClient();

  const total = await supabase
    .from('chats')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (total.error) {
    throw new AppError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Failed to load chat stats.',
      cause: total.error,
    });
  }

  const archived = await supabase
    .from('chats')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_archived', true);
  if (archived.error) {
    throw new AppError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Failed to load chat stats.',
      cause: archived.error,
    });
  }

  return {
    totalChats: total.count ?? 0,
    archivedChats: archived.count ?? 0,
  };
}
