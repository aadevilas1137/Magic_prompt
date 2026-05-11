'use client';

import { useTranslations } from 'next-intl';

import type { Chat, Message } from '@magic-prompt/shared';

import { ChatComposer } from '@/features/chat/components/composer';
import { ChatHeader } from '@/features/chat/components/layout/chat-header';
import { ChatMessages } from '@/features/chat/components/messages-list';
import { useStreamingChat } from '@/features/chat/hooks';
import { useRouter } from '@/i18n/navigation';
import { ROUTES } from '@/lib/constants';
import { env } from '@/lib/env';

interface ChatViewProps {
  readonly userId: string;
  readonly chat: Chat;
  readonly initialMessages: readonly Message[];
}

const MAX_MESSAGE_LENGTH_FALLBACK = 8000;

/**
 * The full single-chat view. Composes header + messages + composer.
 *
 * Owns the `useStreamingChat` hook so token-level state stays in one place;
 * the composer + messages-list are pure presentation components driven by
 * its outputs.
 */
export function ChatView({ userId, chat, initialMessages }: ChatViewProps) {
  const router = useRouter();
  const tErr = useTranslations('chat.errors');
  const streaming = useStreamingChat({ chatId: chat.id, initialMessages });

  // `env.CHAT_MAX_MESSAGE_LENGTH` is server-side only; on the client we
  // fall back to a sane default. Phase 5+ exposes a NEXT_PUBLIC mirror.
  const maxLength =
    typeof window === 'undefined' ? env.CHAT_MAX_MESSAGE_LENGTH : MAX_MESSAGE_LENGTH_FALLBACK;

  // Surface stream errors via toast handled at consumer level — for now,
  // the inline error bubble inside <ChatMessages /> does the work.
  void tErr;

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
