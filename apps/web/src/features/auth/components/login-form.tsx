'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useEffect, useTransition } from 'react';
import { useFormState } from 'react-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { GoogleOAuthButton } from './google-oauth-button';

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
import { Separator } from '@/components/ui/separator';
import { loginAction } from '@/features/auth/actions/login';
import { IDLE_STATE } from '@/features/auth/actions/types';
import { LoginSchema, type LoginInput } from '@/features/auth/lib/validation';
import { Link } from '@/i18n/navigation';

interface LoginFormProps {
  readonly redirectTo?: string | undefined;
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const t = useTranslations('auth');
  const [state, formAction] = useFormState(loginAction, IDLE_STATE);
  const [isPending, startTransition] = useTransition();

  const form = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
  });

  useEffect(() => {
    if (state.status === 'error') {
      if (state.fieldErrors) {
        for (const [field, messages] of Object.entries(state.fieldErrors)) {
          if (messages?.[0]) {
            form.setError(field as keyof LoginInput, { message: messages[0] });
          }
        }
      } else {
        toast.error(state.message);
      }
    }
  }, [state, form]);

  function onSubmit(values: LoginInput) {
    const fd = new FormData();
    fd.set('email', values.email);
    fd.set('password', values.password);
    if (redirectTo) fd.set('redirect', redirectTo);
    startTransition(() => formAction(fd));
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
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>{t('fields.password')}</FormLabel>
                <Link
                  href="/forgot-password"
                  className="text-muted-foreground text-xs underline-offset-2 hover:underline"
                >
                  {t('fields.forgotLink')}
                </Link>
              </div>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? t('login.submitPending') : t('login.submit')}
        </Button>
        <div className="relative my-4">
          <Separator />
          <span className="bg-card text-muted-foreground absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 px-2 text-xs uppercase tracking-wide">
            {t('or')}
          </span>
        </div>
        <GoogleOAuthButton redirectTo={redirectTo} />
      </form>
    </Form>
  );
}
