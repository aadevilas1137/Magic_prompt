import { useTranslations } from 'next-intl';

/**
 * Three-dot "Assistant is thinking" placeholder shown after a user sends
 * a message but before the first assistant token arrives.
 */
export function ChatTypingIndicator() {
  const t = useTranslations('chat.message');
  return (
    <div
      data-testid="chat-typing-indicator"
      className="text-muted-foreground flex items-center gap-2 px-3 py-3 text-xs sm:px-4"
    >
      <div className="flex items-center gap-1" aria-hidden>
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
      </div>
      <span>{t('thinking')}</span>
    </div>
  );
}
