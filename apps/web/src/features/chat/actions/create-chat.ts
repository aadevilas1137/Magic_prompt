'use server';

import { chats } from '@magic-prompt/database';
import { ErrorCode } from '@magic-prompt/shared';
import { revalidatePath } from 'next/cache';

import {
  chatLogger,
  fieldErrorState,
  getClientIp,
  internalErrorState,
  type ChatActionState,
} from './_shared';

import { compactProperties, trackChatEvent } from '@/features/chat/lib/analytics';
import { ChatRateLimits, checkRateLimit } from '@/features/chat/lib/rate-limit';
import { CreateChatSchema } from '@/features/chat/lib/validation';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';

const log = chatLogger.child({ action: 'create-chat' });

export interface CreateChatInput {
  readonly title?: string;
}

/**
 * Server Action — create a new chat owned by the authenticated user.
 *
 * Drizzle insert with explicit `userId` filter. RLS is bypassed by the
 * Drizzle connection (postgres role has BYPASSRLS), so the explicit
 * `userId: user.id` is the security boundary here.
 */
export async function createChatAction(input: CreateChatInput = {}): Promise<ChatActionState> {
  const user = await requireUser('/chat');

  const parsed = CreateChatSchema.safeParse(input);
  if (!parsed.success) {
    return fieldErrorState(parsed, 'Invalid chat title.');
  }

  const ip = getClientIp();
  const rl = checkRateLimit('createChat', user.id, ChatRateLimits.createChat);
  if (!rl.allowed) {
    log.warn({ userId: user.id, ip, retryAfter: rl.retryAfterSeconds }, 'rate limit');
    return {
      status: 'error',
      code: ErrorCode.RATE_LIMITED,
      message: `Too many chats created. Try again in ${rl.retryAfterSeconds}s.`,
    };
  }

  try {
    const db = getDb();
    const [row] = await db
      .insert(chats)
      .values({
        userId: user.id,
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
      })
      .returning({ id: chats.id });

    if (!row) {
      log.error({ userId: user.id }, 'insert returned no row');
      return internalErrorState();
    }

    log.info({ userId: user.id, chatId: row.id }, 'chat created');
    trackChatEvent({
      distinctId: user.id,
      event: 'chat.created',
      properties: compactProperties({ userId: user.id, chatId: row.id }),
    });

    revalidatePath('/chat');
    return { status: 'success', chatId: row.id };
  } catch (err) {
    log.error(
      { userId: user.id, err: err instanceof Error ? err.message : String(err) },
      'create failed',
    );
    return internalErrorState();
  }
}
