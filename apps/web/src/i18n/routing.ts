import { defineRouting } from 'next-intl/routing';

/**
 * next-intl routing config: supported locales, default, and prefixing rule.
 *
 * `localePrefix: 'as-needed'` keeps URLs un-prefixed for the default locale
 * (`/login` instead of `/en/login`) while non-default locales get a prefix
 * (`/hi/login`). This is gentler for English-speaking users (no breaking
 * change for existing /chat / /login URLs after Phase 2 ships) while still
 * supporting `/hi/...` for the Phase 2 DoD.
 */
export const routing = defineRouting({
  locales: ['en', 'hi'] as const,
  defaultLocale: 'en',
  localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];
