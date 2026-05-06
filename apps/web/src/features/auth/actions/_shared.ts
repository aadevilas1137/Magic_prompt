import 'server-only';

import { createLogger } from '@magic-prompt/logger';
import { ErrorCode } from '@magic-prompt/shared';
import { headers } from 'next/headers';

import type { AuthActionState } from './types';
import type { z } from 'zod';

export { IDLE_STATE, type AuthActionState } from './types';

export const authLogger = createLogger('auth:actions');

/**
 * Best-effort client IP extraction. For local dev with no proxy, falls back
 * to a fixed string so rate limits still work per-process. In production
 * (behind Vercel / Cloudflare / similar), `x-forwarded-for` is the canonical
 * header — strip the leftmost value.
 */
export function getClientIp(): string {
  const h = headers();
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() ?? 'unknown';
  const real = h.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}

/**
 * Convert a Zod safeParse failure into a typed `error` state.
 */
export function fieldErrorState<T>(
  parsed: z.SafeParseError<T>,
  fallbackMessage = 'Please check the form for errors.',
): AuthActionState {
  return {
    status: 'error',
    code: ErrorCode.VALIDATION_ERROR,
    message: fallbackMessage,
    fieldErrors: parsed.error.flatten().fieldErrors as Record<string, readonly string[]>,
  };
}
