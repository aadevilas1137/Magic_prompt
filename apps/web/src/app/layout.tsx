import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

/**
 * Root layout — the absolute minimum required by Next.js App Router. Every
 * actual page lives under `app/[locale]/...`, where `[locale]/layout.tsx`
 * mounts the full provider stack (Theme, TanStack Query, NextIntlClientProvider,
 * Inter font). API routes (`app/api/*`) and the OAuth callback (`app/auth/callback`)
 * don't need any layout at all — Next.js skips this layout for `route.ts` files.
 */
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
