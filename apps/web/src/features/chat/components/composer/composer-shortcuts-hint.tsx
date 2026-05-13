import { useTranslations } from 'next-intl';

/**
 * Hairline-thin keyboard shortcut hint. Renders below the composer.
 * Hidden on narrow viewports — composes well visually but is just noise
 * on a 375px-wide screen.
 */
export function ComposerShortcutsHint() {
  const t = useTranslations('chat.composer');
  return (
    <p className="text-muted-foreground hidden px-2 pt-1 text-[11px] sm:block">
      {t('shortcutHint')}
    </p>
  );
}
