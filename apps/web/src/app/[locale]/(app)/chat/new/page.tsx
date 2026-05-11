import { NewChatRedirect } from './_components/new-chat-redirect';

import type { Metadata } from 'next';

import { requireUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'New chat',
};

/**
 * `/chat/new` — immediately creates a chat (the user navigated here via
 * the sidebar's "New chat" button on mobile, where the welcome page is
 * not shown). Redirects to `/chat/[newId]` on success.
 */
export default async function NewChatPage() {
  const user = await requireUser('/chat/new');
  return <NewChatRedirect userId={user.id} />;
}
