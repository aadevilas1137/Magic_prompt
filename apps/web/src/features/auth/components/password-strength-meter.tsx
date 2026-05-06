'use client';

import { type ZxcvbnResult, zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommonPackage from '@zxcvbn-ts/language-common';
import * as zxcvbnEnPackage from '@zxcvbn-ts/language-en';
import { useEffect, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

const SCORE_LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'] as const;
const SCORE_COLORS = [
  'bg-destructive',
  'bg-destructive/80',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-emerald-600',
] as const;

let optionsConfigured = false;
function ensureZxcvbnConfigured(): void {
  if (optionsConfigured) return;
  // `setOptions` accepts Partial<OptionsType>; we provide only what we need.
  zxcvbnOptions.setOptions({
    translations: zxcvbnEnPackage.translations,
    graphs: zxcvbnCommonPackage.adjacencyGraphs,
    dictionary: {
      ...zxcvbnCommonPackage.dictionary,
      ...zxcvbnEnPackage.dictionary,
    },
  });
  optionsConfigured = true;
}

interface PasswordStrengthMeterProps {
  readonly password: string;
  readonly className?: string;
}

export function PasswordStrengthMeter({ password, className }: PasswordStrengthMeterProps) {
  const [result, setResult] = useState<ZxcvbnResult | null>(null);

  useEffect(() => {
    ensureZxcvbnConfigured();
  }, []);

  const score = useMemo(() => {
    if (!password) return null;
    ensureZxcvbnConfigured();
    return zxcvbn(password);
  }, [password]);

  useEffect(() => {
    setResult(score);
  }, [score]);

  if (!password) return null;
  const s = result?.score ?? 0;

  return (
    <div className={cn('mt-2 space-y-1.5', className)} aria-live="polite">
      <div
        className="flex gap-1"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={s}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              i <= s ? SCORE_COLORS[s] : 'bg-muted',
            )}
          />
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        Strength: <span className="text-foreground font-medium">{SCORE_LABELS[s]}</span>
        {result?.feedback.warning ? <span> — {result.feedback.warning}</span> : null}
      </p>
    </div>
  );
}
