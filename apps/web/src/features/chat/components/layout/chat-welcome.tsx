'use client';

import { Sparkles, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

interface ChatWelcomeProps {
  readonly onNewChat: () => void;
  readonly disabled?: boolean;
}

/**
 * Shown on `/chat` when no chat is selected. Big call-to-action to start
 * a new conversation — the "marketing moment" of the chat surface.
 */
export function ChatWelcome({ onNewChat, disabled }: ChatWelcomeProps) {
  const t = useTranslations('chat.welcome');
  const tNew = useTranslations('chat');
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="bg-primary/10 text-primary rounded-full p-4" aria-hidden>
        <Sparkles className="h-8 w-8" />
      </div>
      <div className="space-y-1">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
          {t('title')}
        </h1>
        <p className="text-muted-foreground max-w-md text-sm">{t('description')}</p>
      </div>
      <Button onClick={onNewChat} disabled={disabled}>
        <Plus className="mr-1.5 h-4 w-4" />
        {tNew('newChat')}
      </Button>
    </div>
  );
}
