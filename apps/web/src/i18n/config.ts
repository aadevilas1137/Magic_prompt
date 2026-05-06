// Re-export the routing config so existing imports of {locales, defaultLocale}
// keep working. New code should import from `./routing` directly.
export { routing } from './routing';
export type { Locale } from './routing';

import { routing } from './routing';

export const locales = routing.locales;
export const defaultLocale = routing.defaultLocale;
