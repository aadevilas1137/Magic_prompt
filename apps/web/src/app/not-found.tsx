import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { ROUTES } from '@/lib/constants';

export default function NotFound() {
  const t = useTranslations('errors');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <h2 className="text-2xl font-semibold">{t('notFoundTitle')}</h2>
      <p className="text-muted-foreground max-w-md text-center text-sm">{t('notFoundBody')}</p>
      <Link
        href={ROUTES.HOME}
        className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90"
      >
        {t('goHome')}
      </Link>
    </div>
  );
}
