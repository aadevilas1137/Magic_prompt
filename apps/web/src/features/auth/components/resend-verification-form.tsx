'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useTransition } from 'react';
import { useFormState } from 'react-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { resendVerificationAction } from '@/features/auth/actions/resend-verification';
import { IDLE_STATE } from '@/features/auth/actions/types';

interface ResendVerificationFormProps {
  readonly email: string;
}

export function ResendVerificationForm({ email }: ResendVerificationFormProps) {
  const t = useTranslations('auth');
  const [state, formAction] = useFormState(resendVerificationAction, IDLE_STATE);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (state.status === 'success' && state.message) {
      toast.success(state.message);
    } else if (state.status === 'error') {
      toast.error(state.message);
    }
  }, [state]);

  function onSubmit() {
    const fd = new FormData();
    fd.set('email', email);
    startTransition(() => formAction(fd));
  }

  return (
    <Button type="button" variant="link" onClick={onSubmit} disabled={isPending}>
      {isPending ? t('forgot.submitPending') : `${t('verify.signupAgain')} (${email})`}
    </Button>
  );
}
