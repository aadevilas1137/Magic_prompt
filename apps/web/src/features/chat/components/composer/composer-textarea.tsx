'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

import { cn } from '@/lib/utils';

interface ComposerTextareaProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly maxLength?: number;
}

export interface ComposerTextareaHandle {
  focus(): void;
}

const MIN_ROWS = 1;
const MAX_ROWS = 8;

/**
 * Auto-growing textarea, capped at MAX_ROWS rows (then it scrolls internally).
 *
 * Enter → submit. Shift+Enter → newline. We honour IME composition (avoid
 * sending mid-Japanese/Chinese input) by checking `isComposing` on the event.
 */
export const ComposerTextarea = forwardRef<ComposerTextareaHandle, ComposerTextareaProps>(
  function ComposerTextarea({ value, onChange, onSubmit, placeholder, disabled, maxLength }, ref) {
    const inputRef = useRef<HTMLTextAreaElement | null>(null);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
    }));

    // Auto-grow effect — resize on every value change.
    useEffect(() => {
      const el = inputRef.current;
      if (!el) return;
      el.style.height = 'auto';
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
      const maxHeight = lineHeight * MAX_ROWS + 24;
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
      el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }, [value]);

    return (
      <textarea
        ref={inputRef}
        rows={MIN_ROWS}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        {...(maxLength !== undefined && { maxLength })}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onSubmit();
          }
        }}
        aria-label="Message"
        data-testid="composer-textarea"
        className={cn(
          'flex-1 resize-none bg-transparent text-sm outline-none',
          'placeholder:text-muted-foreground',
          'disabled:cursor-not-allowed disabled:opacity-60',
          'min-h-[44px] py-3 pr-2 leading-[1.5]',
        )}
      />
    );
  },
);
