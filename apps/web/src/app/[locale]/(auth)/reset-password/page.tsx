import { getTranslations } from 'next-intl/server';

import type { Metadata } from 'next';

import { AuthCard } from '@/features/auth/components/auth-card';
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form';

export const metadata: Metadata = {
  title: 'Reset password',
};

export default async function ResetPasswordPage() {
  const t = await getTranslations('auth.reset');

  return (
    <AuthCard title={t('title')} description={t('description')}>
      <ResetPasswordForm />
    </AuthCard>
  );
}
