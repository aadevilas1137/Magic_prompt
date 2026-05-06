import { getRequestConfig } from 'next-intl/server';

import { routing, type Locale } from './routing';

type Messages = Record<string, unknown>;

function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (routing.locales as readonly string[]).includes(value);
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: Locale = isSupportedLocale(requested) ? requested : routing.defaultLocale;
  const mod = (await import(`../../messages/${locale}.json`)) as { default: Messages };
  return {
    locale,
    messages: mod.default as Parameters<typeof getRequestConfig>[0] extends (
      ...args: unknown[]
    ) => infer R
      ? R extends Promise<infer C>
        ? C extends { messages?: infer M }
          ? M
          : never
        : never
      : never,
  };
});
