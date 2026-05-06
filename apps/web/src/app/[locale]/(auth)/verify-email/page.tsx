import { Mail } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import type { Metadata } from 'next';

import { Button } from '@/components/ui/button';
import { AuthCard } from '@/features/auth/components/auth-card';
import { ResendVerificationForm } from '@/features/auth/components/resend-verification-form';
import { Link } from '@/i18n/navigation';

export const metadata: Metadata = {
  title: 'Verify your email',
};

interface VerifyEmailPageProps {
  readonly searchParams: Promise<{ email?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { email } = await searchParams;
  const t = await getTranslations('auth.verify');

  return (
    <AuthCard
      title={t('title')}
      description={email ? t('descriptionWithEmail', { email }) : t('descriptionGeneric')}
      footer={
        <>
          {t('wrongEmail')}{' '}
          <Link
            href="/signup"
            className="text-foreground font-medium underline-offset-2 hover:underline"
          >
            {t('signupAgain')}
          </Link>
        </>
      }
    >
      <div className="flex flex-col items-center gap-6 py-4 text-center">
        <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-full">
          <Mail className="text-muted-foreground h-8 w-8" aria-hidden />
        </div>
        <p className="text-muted-foreground text-sm">
          {t('expiry')}{' '}
          <Link
            href="/login"
            className="text-foreground font-medium underline-offset-2 hover:underline"
          >
            {t('signInHere')}
          </Link>{' '}
          {t('alreadyVerified')}
        </p>
        {email ? <ResendVerificationForm email={email} /> : null}
        <Button asChild variant="outline">
          <Link href="/login">{t('back')}</Link>
        </Button>
      </div>
    </AuthCard>
  );
}
