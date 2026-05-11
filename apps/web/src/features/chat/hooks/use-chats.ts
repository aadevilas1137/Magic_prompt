'use client';

import { useInfiniteQuery } from '@tanstack/react-query';

import type { Chat } from '@magic-prompt/shared';

import { listChatsAction } from '@/features/chat/actions';
import { QUERY_KEYS } from '@/lib/constants';

export interface UseChatsOptions {
  readonly userId: string;
  readonly includeArchived?: boolean;
  readonly initialData?: {
    chats: readonly Chat[];
    nextCursor: string | null;
  };
}

export interface ChatPage {
  readonly chats: readonly Chat[];
  readonly nextCursor: string | null;
}

/**
 * Paginated chat list, sorted by `lastMessageAt DESC`. Wraps the
 * `listChatsAction` server action with TanStack Query's infinite-query
 * machinery. Initial data flows in from the server component via
 * `initialData` to avoid the flash-of-loading on first render.
 */
export function useChats(opts: UseChatsOptions) {
  return useInfiniteQuery({
    queryKey: QUERY_KEYS.chats.list({
      userId: opts.userId,
      ...(opts.includeArchived !== undefined && { includeArchived: opts.includeArchived }),
    }),
    queryFn: async ({ pageParam }) => {
      const result = await listChatsAction({
        ...(typeof pageParam === 'string' ? { cursor: pageParam } : {}),
        ...(opts.includeArchived !== undefined && { includeArchived: opts.includeArchived }),
      });
      return {
        chats: result.chats.map(coerceChat),
        nextCursor: result.nextCursor,
      } satisfies ChatPage;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    ...(opts.initialData && {
      initialData: {
        pages: [
          {
            chats: opts.initialData.chats.map(coerceChat),
            nextCursor: opts.initialData.nextCursor,
          },
        ],
        pageParams: [null as string | null],
      },
    }),
    staleTime: 30_000,
  });
}

/**
 * Server Actions ship Date objects as ISO strings over the wire. Convert
 * back here so consumers see proper `Date` instances.
 */
function coerceChat(c: Chat): Chat {
  return {
    ...c,
    lastMessageAt: new Date(c.lastMessageAt),
    createdAt: new Date(c.createdAt),
    updatedAt: new Date(c.updatedAt),
  };
}
