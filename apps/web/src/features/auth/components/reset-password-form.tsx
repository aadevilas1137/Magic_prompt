'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useEffect, useTransition } from 'react';
import { useFormState } from 'react-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { PasswordStrengthMeter } from './password-strength-meter';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { resetPasswordAction } from '@/features/auth/actions/reset-password';
import { IDLE_STATE } from '@/features/auth/actions/types';
import { ResetPasswordSchema, type ResetPasswordInput } from '@/features/auth/lib/validation';

export function ResetPasswordForm() {
  const t = useTranslations('auth');
  const [state, formAction] = useFormState(resetPasswordAction, IDLE_STATE);
  const [isPending, startTransition] = useTransition();

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
    mode: 'onBlur',
  });

  const passwordValue = form.watch('password');

  useEffect(() => {
    if (state.status === 'error') {
      if (state.fieldErrors) {
        for (const [field, messages] of Object.entries(state.fieldErrors)) {
          if (messages?.[0]) {
            form.setError(field as keyof ResetPasswordInput, { message: messages[0] });
          }
        }
      } else {
        toast.error(state.message);
      }
    }
  }, [state, form]);

  function onSubmit(values: ResetPasswordInput) {
    const fd = new FormData();
    fd.set('password', values.password);
    fd.set('confirmPassword', values.confirmPassword);
    startTransition(() => formAction(fd));
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fields.newPassword')}</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <PasswordStrengthMeter password={passwordValue || ''} />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fields.confirmNewPassword')}</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? t('reset.submitPending') : t('reset.submit')}
        </Button>
      </form>
    </Form>
  );
}
