'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useEffect, useTransition } from 'react';
import { useFormState } from 'react-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { forgotPasswordAction } from '@/features/auth/actions/forgot-password';
import { IDLE_STATE } from '@/features/auth/actions/types';
import { ForgotPasswordSchema, type ForgotPasswordInput } from '@/features/auth/lib/validation';

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const [state, formAction] = useFormState(forgotPasswordAction, IDLE_STATE);
  const [isPending, startTransition] = useTransition();

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: { email: '' },
    mode: 'onBlur',
  });

  useEffect(() => {
    if (state.status === 'error') {
      if (state.fieldErrors) {
        for (const [field, messages] of Object.entries(state.fieldErrors)) {
          if (messages?.[0]) {
            form.setError(field as keyof ForgotPasswordInput, { message: messages[0] });
          }
        }
      } else {
        toast.error(state.message);
      }
    }
  }, [state, form]);

  function onSubmit(values: ForgotPasswordInput) {
    const fd = new FormData();
    fd.set('email', values.email);
    startTransition(() => formAction(fd));
  }

  if (state.status === 'success') {
    return (
      <Alert>
        <AlertDescription>{state.message ?? t('forgot.successGeneric')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fields.email')}</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? t('forgot.submitPending') : t('forgot.submit')}
        </Button>
      </form>
    </Form>
  );
}
