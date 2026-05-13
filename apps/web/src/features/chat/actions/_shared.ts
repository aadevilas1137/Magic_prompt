import 'server-only';

import { createLogger } from '@magic-prompt/logger';
import { ErrorCode } from '@magic-prompt/shared';
import { headers } from 'next/headers';

import type { ChatActionState } from './types';
import type { z } from 'zod';

export { IDLE_STATE, type ChatActionState } from './types';

export const chatLogger = createLogger('chat:actions');

/**
 * Best-effort client IP extraction. Matches the auth-actions pattern so chat
 * rate limits share the same identification logic.
 */
export function getClientIp(): string {
  const h = headers();
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() ?? 'unknown';
  const real = h.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}

export function fieldErrorState<T>(
  parsed: z.SafeParseError<T>,
  fallbackMessage = 'Please check the input for errors.',
): ChatActionState {
  return {
    status: 'error',
    code: ErrorCode.VALIDATION_ERROR,
    message: fallbackMessage,
    fieldErrors: parsed.error.flatten().fieldErrors as Record<string, readonly string[]>,
  };
}

export function unauthorizedState(): ChatActionState {
  return {
    status: 'error',
    code: ErrorCode.UNAUTHORIZED,
    message: 'You must be signed in to do that.',
  };
}

export function notFoundState(): ChatActionState {
  return {
    status: 'error',
    code: ErrorCode.NOT_FOUND,
    message: 'Chat not found.',
  };
}

export function internalErrorState(): ChatActionState {
  return {
    status: 'error',
    code: ErrorCode.INTERNAL_ERROR,
    message: 'Something went wrong. Please try again.',
  };
}
