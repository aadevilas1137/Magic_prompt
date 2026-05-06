/**
 * Validate a redirect target to prevent open-redirect vulnerabilities.
 *
 * Open redirect = an attacker crafts a link like
 * `https://magic-prompt.ai/login?redirect=https://evil.com/phish` and the
 * app blindly redirects after login → phishing attack vector.
 *
 * Rules:
 *  - Must be a non-empty string starting with a single `/`
 *  - Reject `//host/...` (protocol-relative URL — escapes origin)
 *  - Reject `/\\host/...` (Windows-style path that some browsers normalise)
 *  - Reject anything containing a colon before the first `/` (e.g. `javascript:`)
 *
 * Anything that fails these checks falls back to the default safe path.
 */

const DEFAULT_REDIRECT = '/chat';

export function safeRedirect(
  target: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT,
): string {
  if (typeof target !== 'string') return fallback;
  if (target.length === 0) return fallback;
  if (!target.startsWith('/')) return fallback;
  if (target.startsWith('//')) return fallback;
  if (target.startsWith('/\\')) return fallback;
  // Reject anything with a colon before the first slash after position 0.
  // A legitimate redirect path never contains a scheme; if there's a colon
  // somewhere weird, treat as suspicious.
  const colonIdx = target.indexOf(':');
  if (colonIdx > 0 && colonIdx < target.indexOf('/', 1)) return fallback;
  return target;
}

export const SAFE_REDIRECT_DEFAULT = DEFAULT_REDIRECT;
