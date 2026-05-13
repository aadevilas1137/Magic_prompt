'use client';

import type { Chat, Message } from '@magic-prompt/shared';

import { ChatComposer } from '@/features/chat/components/composer';
import { ChatHeader } from '@/features/chat/components/layout/chat-header';
import { ChatMessages } from '@/features/chat/components/messages-list';
import { useStreamingChat } from '@/features/chat/hooks';
import { useRouter } from '@/i18n/navigation';
import { ROUTES } from '@/lib/constants';

interface ChatViewProps {
  readonly userId: string;
  readonly chat: Chat;
  readonly initialMessages: readonly Message[];
  /** Server-passed mirror of `env.CHAT_MAX_MESSAGE_LENGTH`. */
  readonly maxMessageLength?: number;
}

const MAX_MESSAGE_LENGTH_FALLBACK = 8000;

/**
 * The full single-chat view. Composes header + messages + composer.
 *
 * Owns the `useStreamingChat` hook so token-level state stays in one place;
 * the composer + messages-list are pure presentation components driven by
 * its outputs.
 *
 * Note: this is a `'use client'` component. It MUST NOT import `@/lib/env`
 * — `env.ts` parses `process.env` with strict Zod validation, and the
 * client bundle doesn't see non-NEXT_PUBLIC env vars, so the import would
 * crash on hydration. The parent server component reads `env` and passes
 * the relevant pieces in as props instead.
 */
export function ChatView({
  userId,
  chat,
  initialMessages,
  maxMessageLength = MAX_MESSAGE_LENGTH_FALLBACK,
}: ChatViewProps) {
  const router = useRouter();
  const streaming = useStreamingChat({ chatId: chat.id, initialMessages });
  const maxLength = maxMessageLength;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <ChatHeader userId={userId} chat={chat} onChatRemoved={() => router.replace(ROUTES.CHAT)} />
      <ChatMessages
        messages={streaming.messages}
        isStreaming={streaming.isStreaming}
        streamError={streaming.error ?? null}
      />
      <ChatComposer
        chatId={chat.id}
        isStreaming={streaming.isStreaming}
        maxLength={maxLength}
        onSend={streaming.send}
        onStop={streaming.stop}
      />
    </div>
  );
}
