/**
 * Pure types + constants shared between server actions and client forms.
 * **No server-only imports here** — this module is safe to bundle into the
 * client (forms read `IDLE_STATE` and the `AuthActionState` discriminated
 * union for `useActionState`).
 *
 * The server-only bits (logger, IP extraction, field-error helper) live in
 * `./_shared.ts` and must only be imported from action files marked
 * `'use server'`.
 */
import type { ErrorCode as ErrorCodeT } from '@magic-prompt/shared';

export type AuthActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'success'; readonly message?: string }
  | {
      readonly status: 'error';
      readonly code: ErrorCodeT;
      readonly message: string;
      readonly fieldErrors?: Record<string, readonly string[]>;
    };

export const IDLE_STATE: AuthActionState = { status: 'idle' };
