'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ChatMessagesEmpty } from './chat-messages-empty';
import { JumpToBottomButton } from './jump-to-bottom-button';

import type { UIMessage } from 'ai';

import { ChatMessage, ChatTypingIndicator } from '@/features/chat/components/message';
import { cn } from '@/lib/utils';

const NEAR_BOTTOM_PX = 100;

interface ChatMessagesProps {
  readonly messages: readonly UIMessage[];
  readonly isStreaming: boolean;
  readonly streamError?: Error | null;
  readonly onRetry?: () => void;
}

/**
 * Scrollable message list with auto-scroll discipline.
 *
 * Behaviour:
 *   - When `messages` updates AND the user is currently "near bottom"
 *     (within `NEAR_BOTTOM_PX`), the container scrolls to the bottom.
 *   - When the user has scrolled up, the list does NOT auto-scroll —
 *     a floating "Jump to bottom" button appears instead. Tapping it
 *     scrolls and re-engages auto-follow.
 *   - The typing indicator renders ONLY between the moment the user
 *     submits a turn and the first assistant token arriving. After the
 *     first token, the streaming bubble takes over.
 */
export function ChatMessages({ messages, isStreaming, streamError, onRetry }: ChatMessagesProps) {
  const tErr = useTranslations('chat.errors');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollToBottom = useCallback((smooth = true) => {
    endRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
  }, []);

  // Auto-scroll on new messages if user is near bottom.
  useEffect(() => {
    if (isAtBottom) scrollToBottom(false);
  }, [messages, isAtBottom, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsAtBottom(distanceFromBottom < NEAR_BOTTOM_PX);
  }, []);

  const lastMessage = messages[messages.length - 1];
  const showTypingIndicator =
    isStreaming &&
    (!lastMessage || lastMessage.role !== 'assistant' || messageText(lastMessage) === '');

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex flex-1 flex-col">
        <ChatMessagesEmpty />
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className={cn(
          'flex-1 overflow-y-auto overscroll-contain scroll-smooth',
          'mx-auto w-full max-w-3xl',
        )}
        data-testid="chat-messages"
      >
        <div className="flex flex-col py-4">
          {messages.map((m) => {
            const text = messageText(m);
            if (m.role === 'user') {
              return <ChatMessage key={m.id} variant="user" content={text} />;
            }
            if (m.role === 'assistant') {
              const isLast = m === lastMessage;
              return (
                <ChatMessage
                  key={m.id}
                  variant="assistant"
                  content={text}
                  isStreaming={isStreaming && isLast}
                />
              );
            }
            return null;
          })}
          {showTypingIndicator && <ChatTypingIndicator />}
          {streamError && (
            <ChatMessage
              variant="error"
              content=""
              errorText={streamError.message || tErr('generic')}
              {...(onRetry && { onRetry })}
            />
          )}
          <div ref={endRef} aria-hidden />
        </div>
      </div>
      <JumpToBottomButton visible={!isAtBottom} onClick={() => scrollToBottom(true)} />
    </div>
  );
}

function messageText(m: UIMessage): string {
  return m.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}
