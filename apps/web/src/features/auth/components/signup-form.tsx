'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useEffect, useTransition } from 'react';
import { useFormState } from 'react-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { GoogleOAuthButton } from './google-oauth-button';
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
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { signupAction } from '@/features/auth/actions/signup';
import { IDLE_STATE } from '@/features/auth/actions/types';
import { SignupSchema, type SignupInput } from '@/features/auth/lib/validation';

export function SignupForm() {
  const t = useTranslations('auth');
  const [state, formAction] = useFormState(signupAction, IDLE_STATE);
  const [isPending, startTransition] = useTransition();

  const form = useForm<SignupInput>({
    resolver: zodResolver(SignupSchema),
    defaultValues: { email: '', password: '', confirmPassword: '', acceptedTos: false as never },
    mode: 'onBlur',
  });

  const passwordValue = form.watch('password');

  useEffect(() => {
    if (state.status === 'error') {
      if (state.fieldErrors) {
        for (const [field, messages] of Object.entries(state.fieldErrors)) {
          if (messages?.[0]) {
            form.setError(field as keyof SignupInput, { message: messages[0] });
          }
        }
      } else {
        toast.error(state.message);
      }
    }
  }, [state, form]);

  function onSubmit(values: SignupInput) {
    const fd = new FormData();
    fd.set('email', values.email);
    fd.set('password', values.password);
    fd.set('confirmPassword', values.confirmPassword);
    fd.set('acceptedTos', values.acceptedTos ? 'true' : 'false');
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
              <FormLabel>{t('fields.password')}</FormLabel>
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
              <FormLabel>{t('fields.confirmPassword')}</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="acceptedTos"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-2 space-y-0">
              <FormControl>
                <input
                  id="acceptedTos"
                  type="checkbox"
                  checked={Boolean(field.value)}
                  onChange={(e) => field.onChange(e.currentTarget.checked)}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  className="border-input bg-background text-primary focus:ring-ring mt-1 h-4 w-4 rounded border focus:outline-none focus:ring-2"
                />
              </FormControl>
              <div className="space-y-0.5 leading-none">
                <Label htmlFor="acceptedTos" className="text-sm font-normal">
                  {t('fields.tos')}
                </Label>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? t('signup.submitPending') : t('signup.submit')}
        </Button>
        <div className="relative my-4">
          <Separator />
          <span className="bg-card text-muted-foreground absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 px-2 text-xs uppercase tracking-wide">
            {t('or')}
          </span>
        </div>
        <GoogleOAuthButton />
      </form>
    </Form>
  );
}
