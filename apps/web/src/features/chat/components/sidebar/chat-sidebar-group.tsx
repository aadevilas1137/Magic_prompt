import { useTranslations } from 'next-intl';

import type { ChatGroupId } from '@/features/chat/lib/group-chats-by-date';
import type { ReactNode } from 'react';

interface ChatSidebarGroupProps {
  readonly id: ChatGroupId;
  readonly children: ReactNode;
}

export function ChatSidebarGroup({ id, children }: ChatSidebarGroupProps) {
  const t = useTranslations('chat.sidebar');
  return (
    <div className="space-y-1" data-testid={`chat-sidebar-group-${id}`}>
      <h3 className="text-muted-foreground bg-background/90 sticky top-0 z-10 px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider backdrop-blur">
        {t(id)}
      </h3>
      <div className="space-y-px">{children}</div>
    </div>
  );
}
