import { getTranslations } from 'next-intl/server';

import type { Metadata } from 'next';

import { AuthCard } from '@/features/auth/components/auth-card';
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form';
import { Link } from '@/i18n/navigation';

export const metadata: Metadata = {
  title: 'Forgot password',
};

export default async function ForgotPasswordPage() {
  const t = await getTranslations('auth.forgot');
  const tNav = await getTranslations('nav');

  return (
    <AuthCard
      title={t('title')}
      description={t('description')}
      footer={
        <>
          {t('footerRemembered')}{' '}
          <Link
            href="/login"
            className="text-foreground font-medium underline-offset-2 hover:underline"
          >
            {tNav('signIn')}
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
