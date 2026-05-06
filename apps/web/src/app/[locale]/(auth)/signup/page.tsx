import { getTranslations } from 'next-intl/server';

import type { Metadata } from 'next';

import { AuthCard } from '@/features/auth/components/auth-card';
import { SignupForm } from '@/features/auth/components/signup-form';
import { Link } from '@/i18n/navigation';

export const metadata: Metadata = {
  title: 'Sign up',
};

export default async function SignupPage() {
  const t = await getTranslations('auth.signup');
  const tNav = await getTranslations('nav');

  return (
    <AuthCard
      title={t('title')}
      description={t('description')}
      footer={
        <>
          {t('footerHaveAccount')}{' '}
          <Link
            href="/login"
            className="text-foreground font-medium underline-offset-2 hover:underline"
          >
            {tNav('signIn')}
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
