'use client';

import { AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { ChatMessageActions } from './chat-message-actions';
import { ChatStreamingCursor } from './chat-streaming-cursor';

import type { ReactNode } from 'react';

import { MarkdownRenderer } from '@/features/chat/components/markdown';
import { cn } from '@/lib/utils';

interface BaseProps {
  readonly content: string;
  readonly isStreaming?: boolean;
  readonly footer?: ReactNode;
}

interface UserMessageProps extends BaseProps {
  readonly variant: 'user';
}

interface AssistantMessageProps extends BaseProps {
  readonly variant: 'assistant';
}

interface ErrorMessageProps extends BaseProps {
  readonly variant: 'error';
  readonly errorText: string;
  readonly onRetry?: () => void;
}

export type ChatMessageProps = UserMessageProps | AssistantMessageProps | ErrorMessageProps;

/**
 * Universal message bubble. Three variants:
 *   - user: right-aligned, primary-tinted card.
 *   - assistant: left-aligned, no card, full-width prose. Renders markdown.
 *   - error: left-aligned card with a destructive accent + retry CTA.
 *
 * Streaming-aware: while `isStreaming`, the assistant variant shows a
 * blinking caret after the last token. ARIA live region wraps assistant +
 * error so screen readers announce updates.
 */
export function ChatMessage(props: ChatMessageProps) {
  if (props.variant === 'user') return <UserBubble {...props} />;
  if (props.variant === 'error') return <ErrorBubble {...props} />;
  return <AssistantBubble {...props} />;
}

function UserBubble({ content, footer }: UserMessageProps) {
  return (
    <div
      data-variant="user"
      className="flex w-full justify-end px-3 py-2 sm:px-4"
      data-testid="chat-message-user"
    >
      <div
        className={cn(
          'bg-primary text-primary-foreground max-w-[85%] rounded-2xl rounded-tr-md px-4 py-2.5 text-sm shadow-sm',
          'whitespace-pre-wrap break-words',
        )}
      >
        {content}
        {footer && <div className="mt-1.5 text-[11px] opacity-80">{footer}</div>}
      </div>
    </div>
  );
}

function AssistantBubble({ content, isStreaming, footer }: AssistantMessageProps) {
  return (
    <div
      data-variant="assistant"
      className="group w-full px-3 py-2 sm:px-4"
      data-testid="chat-message-assistant"
      aria-live={isStreaming ? 'polite' : 'off'}
    >
      <div className="text-foreground max-w-3xl">
        <MarkdownRenderer content={content} />
        {isStreaming && <ChatStreamingCursor />}
        <div className="mt-2 flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <ChatMessageActions content={content} disabled={isStreaming} />
        </div>
        {footer && <div className="text-muted-foreground mt-1.5 text-xs">{footer}</div>}
      </div>
    </div>
  );
}

function ErrorBubble({ content, errorText, onRetry }: ErrorMessageProps) {
  const t = useTranslations('chat.errors');
  return (
    <div
      data-variant="error"
      className="w-full px-3 py-2 sm:px-4"
      data-testid="chat-message-error"
      role="alert"
    >
      <div className="border-destructive/30 bg-destructive/5 text-destructive-foreground/80 max-w-3xl rounded-md border px-3 py-2 text-sm">
        <div className="flex items-start gap-2">
          <AlertCircle className="text-destructive mt-0.5 h-4 w-4 flex-none" aria-hidden />
          <div className="flex-1">
            {content && (
              <div className="text-foreground mb-1 whitespace-pre-wrap break-words">{content}</div>
            )}
            <div className="text-destructive text-xs">{errorText}</div>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="border-destructive/30 hover:bg-destructive/10 mt-2 inline-flex h-7 items-center rounded-md border px-2 text-xs font-medium"
              >
                {t('retry')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
