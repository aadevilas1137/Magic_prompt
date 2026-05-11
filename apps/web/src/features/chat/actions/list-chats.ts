'use server';

import type { Chat } from '@magic-prompt/shared';

import { getChats, type GetChatsResult } from '@/features/chat/queries/get-chats';
import { requireUser } from '@/lib/auth';

export interface ListChatsInput {
  readonly cursor?: string;
  readonly includeArchived?: boolean;
  readonly limit?: number;
}

/**
 * Client-callable wrapper around `getChats`. Adds the `requireUser()` gate
 * (queries themselves trust the caller) and serialises Date instances over
 * the Server-Action boundary into ISO strings — React Query receives plain
 * JSON, so we coerce back on the client side.
 */
export async function listChatsAction(
  input: ListChatsInput = {},
): Promise<{ chats: readonly Chat[]; nextCursor: string | null }> {
  const user = await requireUser('/chat');
  const result: GetChatsResult = await getChats({
    userId: user.id,
    ...(input.cursor !== undefined && { cursor: input.cursor }),
    ...(input.includeArchived !== undefined && { includeArchived: input.includeArchived }),
    ...(input.limit !== undefined && { limit: input.limit }),
  });
  return { chats: result.chats, nextCursor: result.nextCursor };
}
