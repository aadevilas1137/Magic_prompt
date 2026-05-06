import { getRequestConfig, type GetRequestConfigParams } from 'next-intl/server';

import { defaultLocale, type Locale } from './config';

type Messages = Record<string, unknown>;

async function loadMessages(locale: Locale): Promise<Messages> {
  const mod = (await import(`../../messages/${locale}.json`)) as { default: Messages };
  return mod.default;
}

export default getRequestConfig(async (_params: GetRequestConfigParams) => {
  const locale: Locale = defaultLocale;
  const messages = await loadMessages(locale);
  return {
    locale,
    // next-intl's `AbstractIntlMessages` shape is recursive; our JSON is the
    // shape it expects (string leaves, object branches). The cast is the
    // narrowest annotation that satisfies the runtime contract.
    messages: messages as Parameters<typeof getRequestConfig>[0] extends (
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
