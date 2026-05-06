'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

/**
 * Empty chat shell for Phase 1. The composer is rendered but disabled — the
 * real wiring lands in Phase 2 (auth) and Phase 3+ (chat persistence + IPE).
 */
export function ChatShell() {
  const tApp = useTranslations('app');
  const tChat = useTranslations('chat');

  return (
    <div className={cn('mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6')}>
      <header className="space-y-1 py-6">
        <h1 className="text-3xl font-bold tracking-tight">{tApp('name')}</h1>
        <p className="text-muted-foreground text-sm">{tApp('tagline')}</p>
      </header>

      <main className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground text-sm">{tChat('phase1Notice')}</p>
      </main>

      <footer className="space-y-2 border-t pt-4">
        <label htmlFor="chat-input" className="sr-only">
          {tChat('title')}
        </label>
        <div className="flex gap-2">
          <textarea
            id="chat-input"
            disabled
            rows={3}
            className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring flex-1 resize-none rounded-lg border p-3 text-sm focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
            placeholder={tChat('placeholder')}
          />
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="bg-primary text-primary-foreground self-end rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            {tChat('send')}
          </button>
        </div>
      </footer>
    </div>
  );
}
