import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Rendered when a chat exists but has no messages yet. Different from
 * `ChatWelcome` (which is shown when no chat is selected at all).
 */
export function ChatMessagesEmpty() {
  const t = useTranslations('chat.welcome');
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="bg-primary/10 text-primary rounded-full p-3" aria-hidden>
        <Sparkles className="h-6 w-6" />
      </div>
      <h2 className="text-foreground text-xl font-semibold tracking-tight">{t('title')}</h2>
      <p className="text-muted-foreground max-w-sm text-sm">{t('description')}</p>
    </div>
  );
}
