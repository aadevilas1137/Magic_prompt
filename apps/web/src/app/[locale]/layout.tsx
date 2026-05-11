import { APP_DESCRIPTION, APP_NAME } from '@magic-prompt/shared';
import { Inter } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale, getMessages } from 'next-intl/server';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { Header } from '@/components/layout/header';
import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/sonner';
import { routing, type Locale } from '@/i18n/routing';
import { env } from '@/lib/env';

function isSupportedLocale(value: string): value is Locale {
  return (routing.locales as readonly string[]).includes(value);
}

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  authors: [{ name: 'Magic Prompt AI' }],
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

interface LocaleLayoutProps {
  readonly children: ReactNode;
  readonly params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${inter.variable} bg-background text-foreground font-sans antialiased`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <div className="flex min-h-screen flex-col">
              <Header />
              <div className="flex min-h-0 flex-1 flex-col">{children}</div>
            </div>
            <Toaster richColors closeButton position="top-right" />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
