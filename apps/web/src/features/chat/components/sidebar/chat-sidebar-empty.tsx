import { MessageSquarePlus } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ChatSidebarEmptyProps {
  readonly onNewChat: () => void;
}

export function ChatSidebarEmpty({ onNewChat }: ChatSidebarEmptyProps) {
  const t = useTranslations('chat.sidebar.empty');
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center"
      data-testid="chat-sidebar-empty"
    >
      <MessageSquarePlus className="text-muted-foreground h-6 w-6" aria-hidden />
      <p className="text-foreground text-sm font-medium">{t('title')}</p>
      <p className="text-muted-foreground text-xs">{t('description')}</p>
      <button
        type="button"
        onClick={onNewChat}
        className="bg-primary text-primary-foreground mt-2 inline-flex h-8 items-center rounded-md px-3 text-xs font-medium hover:opacity-90"
      >
        {t('cta')}
      </button>
    </div>
  );
}
