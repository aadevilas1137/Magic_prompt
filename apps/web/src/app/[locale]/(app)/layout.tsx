import type { ReactNode } from 'react';

import { ChatLayout } from '@/features/chat/components/layout';
import { getChats } from '@/features/chat/queries/get-chats';
import { requireUser } from '@/lib/auth';

interface AppLayoutProps {
  readonly children: ReactNode;
  readonly params: Promise<{ locale: string }>;
}

/**
 * `(app)` group — the authenticated shell. Acts as the second gate behind
 * the middleware (defence-in-depth) and pre-loads the chats list so the
 * sidebar renders without a loading flash on first paint.
 *
 * The `activeChatId` is `null` here — the `[chatId]` route reads its own
 * id from the URL and the active-chat store; the layout doesn't need to.
 */
export default async function AppLayout({ children }: AppLayoutProps) {
  const user = await requireUser('/chat');
  const initial = await getChats({ userId: user.id, limit: 50 });

  return (
    <ChatLayout
      userId={user.id}
      activeChatId={null}
      initialChats={{ chats: initial.chats, nextCursor: initial.nextCursor }}
    >
      {children}
    </ChatLayout>
  );
}
