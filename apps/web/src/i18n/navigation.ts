import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

/**
 * Locale-aware drop-in replacements for `next/link` and `next/navigation`.
 * Use these everywhere instead of the bare-Next equivalents — they
 * automatically preserve the active locale on internal navigation.
 *
 * - `Link` → use in JSX where you'd use Next's `<Link>`
 * - `redirect` / `permanentRedirect` → use in Server Components / actions
 * - `usePathname` / `useRouter` → client-side navigation hooks
 * - `getPathname` → build a localized path programmatically (e.g. for emails)
 */
export const { Link, redirect, permanentRedirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
