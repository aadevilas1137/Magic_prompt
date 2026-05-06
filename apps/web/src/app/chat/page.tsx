import type { Metadata } from 'next';

import { ChatShell } from '@/features/chat/components/chat-shell';

export const metadata: Metadata = {
  title: 'Chat',
};

export default function ChatPage() {
  return <ChatShell />;
}
