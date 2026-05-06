import { getTranslations } from 'next-intl/server';

import type { Metadata } from 'next';

import { AuthCard } from '@/features/auth/components/auth-card';
import { LoginForm } from '@/features/auth/components/login-form';
import { Link } from '@/i18n/navigation';

export const metadata: Metadata = {
  title: 'Sign in',
};

interface LoginPageProps {
  readonly searchParams: Promise<{ redirect?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirect } = await searchParams;
  const t = await getTranslations('auth.login');
  const tNav = await getTranslations('nav');

  return (
    <AuthCard
      title={t('title')}
      description={t('description')}
      footer={
        <>
          {t('footerNoAccount')}{' '}
          <Link
            href="/signup"
            className="text-foreground font-medium underline-offset-2 hover:underline"
          >
            {tNav('signUp')}
          </Link>
        </>
      }
    >
      <LoginForm redirectTo={redirect} />
    </AuthCard>
  );
}
