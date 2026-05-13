'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { ChatWelcome } from '@/features/chat/components/layout';
import { useCreateChat } from '@/features/chat/hooks';
import { useActiveChatStore } from '@/features/chat/stores/active-chat-store';
import { useRouter } from '@/i18n/navigation';
import { chatRoute } from '@/lib/constants';

interface NewChatLauncherProps {
  readonly userId: string;
}

export function NewChatLauncher({ userId }: NewChatLauncherProps) {
  const router = useRouter();
  const tErr = useTranslations('chat.errors');
  const createChat = useCreateChat(userId);
  const setActive = useActiveChatStore((s) => s.setActiveChatId);

  const handleNewChat = async () => {
    try {
      const id = await createChat.mutateAsync({});
      setActive(id);
      router.push(chatRoute(id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tErr('generic'));
    }
  };

  return <ChatWelcome onNewChat={handleNewChat} disabled={createChat.isPending} />;
}
