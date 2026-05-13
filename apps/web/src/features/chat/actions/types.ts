/**
 * Pure types + constants shared between chat server actions and any client
 * components that consume their return shape.
 * **No server-only imports** — safe to bundle into client code.
 */
import type { ErrorCode as ErrorCodeT } from '@magic-prompt/shared';

export type ChatActionState =
  | { readonly status: 'idle' }
  | {
      readonly status: 'success';
      readonly message?: string;
      readonly chatId?: string;
    }
  | {
      readonly status: 'error';
      readonly code: ErrorCodeT;
      readonly message: string;
      readonly fieldErrors?: Record<string, readonly string[]>;
    };

export const IDLE_STATE: ChatActionState = { status: 'idle' };
