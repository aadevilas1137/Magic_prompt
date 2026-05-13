'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';

import { ComposerCharCount } from './composer-char-count';
import { ComposerSendButton } from './composer-send-button';
import { ComposerShortcutsHint } from './composer-shortcuts-hint';
import { ComposerTextarea, type ComposerTextareaHandle } from './composer-textarea';

import { useDraftStore } from '@/features/chat/stores/draft-store';
import { cn } from '@/lib/utils';

interface ChatComposerProps {
  readonly chatId: string;
  readonly isStreaming: boolean;
  readonly maxLength: number;
  readonly onSend: (text: string) => void;
  readonly onStop?: () => void;
}

/**
 * Main composer wrapper. Owns:
 *   - Draft persistence (via `useDraftStore`, keyed by `chatId`).
 *   - Send / Stop state.
 *   - Auto-focus on mount and after a successful send.
 *   - Hand-off to the auto-grow textarea + shortcut handling.
 *
 * Submit guards: empty/whitespace-only is rejected at the button level;
 * the textarea's onSubmit also short-circuits on empty content.
 */
export function ChatComposer({
  chatId,
  isStreaming,
  maxLength,
  onSend,
  onStop,
}: ChatComposerProps) {
  const t = useTranslations('chat.composer');
  const draft = useDraftStore((s) => s.getDraft(chatId));
  const setDraft = useDraftStore((s) => s.setDraft);
  const clearDraft = useDraftStore((s) => s.clearDraft);

  const inputRef = useRef<ComposerTextareaHandle | null>(null);

  // Focus on chat change + after streaming stops.
  useEffect(() => {
    inputRef.current?.focus();
  }, [chatId, isStreaming]);

  const trimmed = draft.trim();
  const cannotSend = isStreaming || trimmed.length === 0 || trimmed.length > maxLength;

  const handleSubmit = () => {
    if (cannotSend) return;
    onSend(trimmed);
    clearDraft(chatId);
  };

  const handleButtonClick = () => {
    if (isStreaming && onStop) {
      onStop();
      return;
    }
    handleSubmit();
  };

  return (
    <div className="bg-background border-t" data-testid="chat-composer">
      <div className="mx-auto w-full max-w-3xl p-3 sm:p-4">
        <div
          className={cn(
            'border-input bg-background focus-within:ring-ring flex items-end gap-2 rounded-2xl border px-3 shadow-sm focus-within:ring-1',
          )}
        >
          <ComposerTextarea
            ref={inputRef}
            value={draft}
            onChange={(v) => setDraft(chatId, v)}
            onSubmit={handleSubmit}
            placeholder={t('placeholder')}
            disabled={isStreaming}
            maxLength={maxLength + 100}
          />
          <div className="self-end pb-2">
            <ComposerSendButton
              mode={isStreaming ? 'stop' : 'send'}
              disabled={isStreaming ? !onStop : cannotSend}
              onClick={handleButtonClick}
            />
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <ComposerShortcutsHint />
          <ComposerCharCount value={draft.length} max={maxLength} />
        </div>
      </div>
    </div>
  );
}
