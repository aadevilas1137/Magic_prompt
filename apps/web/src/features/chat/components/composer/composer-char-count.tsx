import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

interface ComposerCharCountProps {
  readonly value: number;
  readonly max: number;
}

/**
 * Char counter that only appears as the user nears the limit (>=80% used).
 * Avoids being a constant distraction while still warning early enough to
 * react before truncation.
 */
export function ComposerCharCount({ value, max }: ComposerCharCountProps) {
  const t = useTranslations('chat.composer');
  const ratio = value / max;
  if (ratio < 0.8) return null;
  const overflow = value > max;
  return (
    <span
      className={cn(
        'text-xs tabular-nums',
        overflow ? 'text-destructive' : 'text-muted-foreground',
      )}
      aria-live="polite"
    >
      {overflow ? t('charCountWarning') : `${value} / ${max}`}
    </span>
  );
}
