import 'server-only';

import { track } from '@magic-prompt/analytics';
import { createLogger } from '@magic-prompt/logger';

const log = createLogger('auth:analytics');

/**
 * Extract the lowercased domain from an email address.
 *
 * Returns `undefined` for malformed input. Used as a PII-safe property on
 * PostHog auth events — we never send the full address.
 */
export function getEmailDomain(email: unknown): string | undefined {
  if (typeof email !== 'string') return undefined;
  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) return undefined;
  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase();
  return domain.length > 0 ? domain : undefined;
}

/**
 * Build an anonymous PostHog `distinctId` from a client IP. Used when no
 * user is authenticated yet (e.g. login attempted, signup attempted).
 */
export function anonDistinctId(ip: string): string {
  return `anon:${ip || 'unknown'}`;
}

export interface AuthTrackInput {
  readonly distinctId: string;
  readonly event: string;
  readonly properties?: Readonly<Record<string, unknown>>;
}

/**
 * Best-effort wrapper around `track()`. Catches anything thrown by the
 * analytics layer so a misconfigured PostHog client can never break an
 * auth flow. The underlying `track()` already no-ops without a key.
 */
export function trackAuthEvent(input: AuthTrackInput): void {
  try {
    track({
      distinctId: input.distinctId,
      event: input.event,
      ...(input.properties !== undefined ? { properties: input.properties } : {}),
    });
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err), event: input.event },
      'analytics track threw — swallowed to protect auth flow',
    );
  }
}

/**
 * Strip undefined-valued keys so they don't ship as `key: undefined` in
 * the PostHog payload. Caller is responsible for not putting PII in here.
 */
export function compactProperties(
  props: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}
