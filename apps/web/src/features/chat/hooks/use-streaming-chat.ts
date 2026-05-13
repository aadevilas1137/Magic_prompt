'use client';

import { useChat } from '@ai-sdk/react';
import { useQueryClient } from '@tanstack/react-query';
import { DefaultChatTransport } from 'ai';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import type { Message } from '@magic-prompt/shared';

import { QUERY_KEYS } from '@/lib/constants';

export interface UseStreamingChatOptions {
  readonly chatId: string;
  readonly initialMessages: readonly Message[];
}

/**
 * Production wrapper around AI SDK's `useChat`.
 *
 *  - Pre-seeds with the persisted messages so the conversation appears
 *    immediately on chat open (no flash of empty state).
 *  - Posts to `/api/chat` with our `chatId` envelope (the route handler
 *    is the persistence + auth boundary).
 *  - On stream completion, invalidates the React Query cache so the
 *    server-confirmed message list replaces optimistic state and refreshes
 *    the sidebar (last-message-at, possibly new title).
 *  - Surfaces a single `isStreaming` flag the composer can read directly.
 */
export function useStreamingChat(opts: UseStreamingChatOptions) {
  const router = useRouter();
  const qc = useQueryClient();

  const seedMessages = useMemo(
    () =>
      opts.initialMessages.map((m) => ({
        id: m.id,
        role: m.role,
        parts: [{ type: 'text' as const, text: m.content }],
      })),
    [opts.initialMessages],
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: { chatId: opts.chatId },
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: {
            ...(body as Record<string, unknown>),
            chatId: opts.chatId,
            messages: messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.parts
                .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
                .map((p) => p.text)
                .join('\n'),
            })),
          },
        }),
      }),
    [opts.chatId],
  );

  const chat = useChat({
    id: opts.chatId,
    messages: seedMessages,
    transport,
    onFinish: () => {
      // Refresh the persisted state — covers title auto-generation, sidebar
      // reordering, and the rare case where the optimistic IDs drift.
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.chats.messages(opts.chatId) });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.chats.all });
      router.refresh();
    },
  });

  const isStreaming = chat.status === 'streaming' || chat.status === 'submitted';

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      chat.sendMessage({
        role: 'user',
        parts: [{ type: 'text', text: trimmed }],
      });
    },
    [chat],
  );

  return {
    messages: chat.messages,
    status: chat.status,
    error: chat.error,
    isStreaming,
    send,
    stop: chat.stop,
  };
}
