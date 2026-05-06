'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

interface ErrorBoundaryProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  const t = useTranslations('errors');

  useEffect(() => {
    console.error('[error.tsx]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <h2 className="text-2xl font-semibold">{t('generic')}</h2>
      {error.message ? (
        <p className="text-muted-foreground max-w-md text-center text-sm">{error.message}</p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90"
      >
        {t('tryAgain')}
      </button>
    </div>
  );
}
