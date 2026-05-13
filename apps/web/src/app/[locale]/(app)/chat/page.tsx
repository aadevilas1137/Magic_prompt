import { NewChatLauncher } from './_components/new-chat-launcher';

import type { Metadata } from 'next';

import { requireUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Chat',
};

/**
 * `/chat` (no chat selected) — shows the welcome state with a CTA to
 * create a new chat. The actual creation is delegated to a client
 * component that calls the createChat mutation and navigates to
 * `/chat/[chatId]` on success.
 */
export default async function ChatIndexPage() {
  const user = await requireUser('/chat');
  return <NewChatLauncher userId={user.id} />;
}
