import 'server-only';

import { track } from '@magic-prompt/analytics';
import { createLogger } from '@magic-prompt/logger';

const log = createLogger('chat:analytics');

export interface ChatTrackInput {
  readonly distinctId: string;
  readonly event: string;
  readonly properties?: Readonly<Record<string, unknown>>;
}

/**
 * Best-effort wrapper around `track()` — analytics must never break a chat
 * flow. The underlying `track()` already no-ops without a PostHog key; this
 * adds an extra try/catch belt-and-braces.
 */
export function trackChatEvent(input: ChatTrackInput): void {
  try {
    track({
      distinctId: input.distinctId,
      event: input.event,
      ...(input.properties !== undefined ? { properties: input.properties } : {}),
    });
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err), event: input.event },
      'analytics track threw — swallowed to protect chat flow',
    );
  }
}

/**
 * Strip undefined-valued keys before they ship to PostHog. Mirrors the
 * auth-side helper so events stay shape-consistent across event families.
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
