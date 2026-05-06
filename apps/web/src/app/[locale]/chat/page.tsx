import type { Metadata } from 'next';

import { ChatShell } from '@/features/chat/components/chat-shell';
import { requireUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Chat',
};

/**
 * /chat is auth-required. Middleware redirects unauthenticated users to
 * `/login?redirect=/chat`; this `requireUser()` is the second line of
 * defense for direct hits or middleware bypass scenarios.
 */
export default async function ChatPage() {
  const user = await requireUser('/chat');

  return (
    <>
      <ChatShell />
      <p className="sr-only" data-testid="user-email">
        Signed in as {user.email}
      </p>
    </>
  );
}
