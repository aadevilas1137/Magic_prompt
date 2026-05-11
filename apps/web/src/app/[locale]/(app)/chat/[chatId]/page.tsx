import { notFound } from 'next/navigation';

import type { Metadata } from 'next';

import { ChatView } from '@/features/chat/components/layout';
import { getChatById } from '@/features/chat/queries/get-chat-by-id';
import { getMessages } from '@/features/chat/queries/get-messages';
import { requireUser } from '@/lib/auth';
import { env } from '@/lib/env';

interface ChatDetailPageProps {
  readonly params: Promise<{ locale: string; chatId: string }>;
}

export async function generateMetadata({ params }: ChatDetailPageProps): Promise<Metadata> {
  const { chatId } = await params;
  const user = await requireUser(`/chat/${chatId}`);
  const chat = await getChatById({ userId: user.id, chatId });
  return { title: chat?.title ?? 'Chat' };
}

export default async function ChatDetailPage({ params }: ChatDetailPageProps) {
  const { chatId } = await params;
  const user = await requireUser(`/chat/${chatId}`);
  const chat = await getChatById({ userId: user.id, chatId });
  if (!chat) notFound();

  const { messages } = await getMessages({ userId: user.id, chatId });

  return (
    <>
      <ChatView
        userId={user.id}
        chat={chat}
        initialMessages={messages}
        maxMessageLength={env.CHAT_MAX_MESSAGE_LENGTH}
      />
      <span data-user-id={user.id} className="hidden" aria-hidden />
    </>
  );
}
