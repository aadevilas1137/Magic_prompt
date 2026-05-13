import { notFound } from 'next/navigation';

import type { Metadata } from 'next';

import { IPEDebugPanel } from '@/features/chat/components/debug/ipe-debug-panel';
import { ChatView } from '@/features/chat/components/layout';
import { isIPEAdmin } from '@/features/chat/lib/ipe-admin';
import { getChatById } from '@/features/chat/queries/get-chat-by-id';
import { getIPEDebugForChat } from '@/features/chat/queries/get-ipe-debug';
import { getMessages } from '@/features/chat/queries/get-messages';
import { requireUser } from '@/lib/auth';
import { env } from '@/lib/env';

interface ChatDetailPageProps {
  readonly params: Promise<{ locale: string; chatId: string }>;
  readonly searchParams: Promise<{ showMagic?: string }>;
}

export async function generateMetadata({ params }: ChatDetailPageProps): Promise<Metadata> {
  const { chatId } = await params;
  const user = await requireUser(`/chat/${chatId}`);
  const chat = await getChatById({ userId: user.id, chatId });
  return { title: chat?.title ?? 'Chat' };
}

export default async function ChatDetailPage({ params, searchParams }: ChatDetailPageProps) {
  const { chatId } = await params;
  const { showMagic } = await searchParams;
  const user = await requireUser(`/chat/${chatId}`);
  const chat = await getChatById({ userId: user.id, chatId });
  if (!chat) notFound();

  const { messages } = await getMessages({ userId: user.id, chatId });

  // Server-side admin gate. Even if `?showMagic=1` is set, isIPEAdmin() must
  // return true OR the debug panel is never rendered. Defence in depth.
  const showDebug = showMagic === '1' && isIPEAdmin(user.email);
  const debugRows = showDebug ? await getIPEDebugForChat({ userId: user.id, chatId }) : [];

  return (
    <>
      <ChatView
        userId={user.id}
        chat={chat}
        initialMessages={messages}
        maxMessageLength={env.CHAT_MAX_MESSAGE_LENGTH}
      />
      {showDebug && <IPEDebugPanel rows={debugRows} chatId={chatId} />}
      <span data-user-id={user.id} className="hidden" aria-hidden />
    </>
  );
}
