'use client';

import { useQuery } from '@tanstack/react-query';

import type { Message } from '@magic-prompt/shared';

import { listMessagesAction } from '@/features/chat/actions';
import { QUERY_KEYS } from '@/lib/constants';

export function useMessages(chatId: string, initialMessages?: readonly Message[]) {
  return useQuery({
    queryKey: QUERY_KEYS.chats.messages(chatId),
    queryFn: async () => {
      const result = await listMessagesAction({ chatId });
      return result.messages.map(coerceMessage);
    },
    ...(initialMessages && { initialData: initialMessages.map(coerceMessage) }),
    staleTime: 10_000,
  });
}

function coerceMessage(m: Message): Message {
  return { ...m, createdAt: new Date(m.createdAt) };
}
