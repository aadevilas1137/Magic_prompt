'use client';

import { Send, Square } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

interface ComposerSendButtonProps {
  readonly mode: 'send' | 'stop';
  readonly disabled?: boolean;
  readonly onClick: () => void;
}

/**
 * Send / Stop button. Tap target ≥40px so mobile users don't fat-finger
 * the wrong action. While streaming, transitions to a "Stop" affordance —
 * Phase 5+ wires the actual `chat.stop()` call from useChat.
 */
export function ComposerSendButton({ mode, disabled, onClick }: ComposerSendButtonProps) {
  const t = useTranslations('chat.composer');
  const isStop = mode === 'stop';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isStop ? t('stop') : t('send')}
      data-testid="composer-send"
      data-mode={mode}
      className={cn(
        'inline-flex h-9 w-9 flex-none items-center justify-center rounded-full transition',
        isStop
          ? 'bg-destructive text-destructive-foreground hover:opacity-90'
          : 'bg-primary text-primary-foreground hover:opacity-90',
        'disabled:cursor-not-allowed disabled:opacity-40',
        'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
      )}
    >
      {isStop ? <Square className="h-4 w-4" /> : <Send className="h-4 w-4" />}
    </button>
  );
}
