import { track } from '@magic-prompt/analytics';
import { createLogger } from '@magic-prompt/logger';

const log = createLogger('ipe:analytics');

export interface IPETrackInput {
  readonly distinctId: string;
  readonly event: string;
  readonly properties?: Readonly<Record<string, unknown>>;
}

/**
 * Best-effort wrapper around `track()` for IPE events. Catches anything the
 * analytics layer might throw so the pipeline can never crash on telemetry.
 *
 * The underlying `track()` already no-ops without `NEXT_PUBLIC_POSTHOG_KEY`.
 *
 * Conventions for IPE events:
 *   - All event names start with `ipe.` (e.g. `ipe.pipeline.started`).
 *   - `distinctId` is the authenticated user's UUID — anonymous IPE calls
 *     should never happen (the route handler `getUser()`s first).
 *   - Property values are scalars + small JSON only. Never include the
 *     magic prompt, the user's full message, or anything that could leak
 *     IPE internals to a PostHog dashboard.
 */
export function trackIPEEvent(input: IPETrackInput): void {
  try {
    track({
      distinctId: input.distinctId,
      event: input.event,
      ...(input.properties !== undefined ? { properties: input.properties } : {}),
    });
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err), event: input.event },
      'IPE analytics track threw — swallowed to protect pipeline flow',
    );
  }
}

/**
 * Strip `undefined`-valued keys so they don't ship as `key: undefined` to
 * PostHog. Mirrors the auth-side helper.
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
