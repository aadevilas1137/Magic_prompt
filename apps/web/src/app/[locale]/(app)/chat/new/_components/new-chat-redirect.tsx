'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { useCreateChat } from '@/features/chat/hooks';
import { useRouter } from '@/i18n/navigation';
import { chatRoute, ROUTES } from '@/lib/constants';

interface NewChatRedirectProps {
  readonly userId: string;
}

/**
 * Fire-and-forget: on mount, calls `createChat`, then either replaces the
 * URL with `/chat/[newId]` on success, or bumps back to `/chat` with a
 * toast on failure.
 */
export function NewChatRedirect({ userId }: NewChatRedirectProps) {
  const router = useRouter();
  const tErr = useTranslations('chat.errors');
  const createChat = useCreateChat(userId);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    createChat
      .mutateAsync({})
      .then((id) => {
        router.replace(chatRoute(id));
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : tErr('generic'));
        router.replace(ROUTES.CHAT);
      });
  }, [createChat, router, tErr]);

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-muted-foreground text-sm">Creating chat…</div>
    </div>
  );
}
