'use client';

import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { cn } from '@/lib/utils';

interface ChatMessageActionsProps {
  readonly content: string;
  readonly disabled?: boolean | undefined;
}

/**
 * Per-message action row. Phase 3 ships Copy only — Regenerate / thumbs
 * land in Phase 6+ when the regenerate flow is wired through the route
 * handler and the messages table's `parent_message_id` is exercised.
 */
export function ChatMessageActions({ content, disabled }: ChatMessageActionsProps) {
  const t = useTranslations('chat.message');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* silent */
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleCopy}
        disabled={disabled || !content}
        aria-label={copied ? t('copied') : t('copy')}
        className={cn(
          'text-muted-foreground hover:text-foreground inline-flex h-7 items-center gap-1 rounded px-2 text-xs',
          'hover:bg-accent focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-1',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        <span>{copied ? t('copied') : t('copy')}</span>
      </button>
    </>
  );
}
