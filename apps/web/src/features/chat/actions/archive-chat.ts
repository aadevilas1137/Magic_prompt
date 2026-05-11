'use server';

import { chats } from '@magic-prompt/database';
import { ErrorCode } from '@magic-prompt/shared';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import {
  chatLogger,
  fieldErrorState,
  internalErrorState,
  notFoundState,
  type ChatActionState,
} from './_shared';

import { compactProperties, trackChatEvent } from '@/features/chat/lib/analytics';
import { ChatRateLimits, checkRateLimit } from '@/features/chat/lib/rate-limit';
import { ChatIdOnlySchema } from '@/features/chat/lib/validation';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';

const log = chatLogger.child({ action: 'archive-chat' });

export async function archiveChatAction(input: { chatId: string }): Promise<ChatActionState> {
  return setArchived(input, true, 'chat.archived', log);
}

export async function unarchiveChatAction(input: { chatId: string }): Promise<ChatActionState> {
  return setArchived(
    input,
    false,
    'chat.unarchived',
    chatLogger.child({ action: 'unarchive-chat' }),
  );
}

async function setArchived(
  input: { chatId: string },
  isArchived: boolean,
  event: string,
  logger: typeof chatLogger,
): Promise<ChatActionState> {
  const user = await requireUser('/chat');

  const parsed = ChatIdOnlySchema.safeParse(input);
  if (!parsed.success) return fieldErrorState(parsed, 'Invalid chat id.');

  const rl = checkRateLimit('mutate', user.id, ChatRateLimits.mutate);
  if (!rl.allowed) {
    return {
      status: 'error',
      code: ErrorCode.RATE_LIMITED,
      message: `Too many requests. Try again in ${rl.retryAfterSeconds}s.`,
    };
  }

  try {
    const db = getDb();
    const updated = await db
      .update(chats)
      .set({ isArchived, updatedAt: new Date() })
      .where(and(eq(chats.id, parsed.data.chatId), eq(chats.userId, user.id)))
      .returning({ id: chats.id });

    if (updated.length === 0) return notFoundState();

    logger.info({ userId: user.id, chatId: parsed.data.chatId, isArchived }, 'archive toggled');
    trackChatEvent({
      distinctId: user.id,
      event,
      properties: compactProperties({ userId: user.id, chatId: parsed.data.chatId }),
    });

    revalidatePath('/chat');
    return { status: 'success', chatId: parsed.data.chatId };
  } catch (err) {
    logger.error(
      { userId: user.id, err: err instanceof Error ? err.message : String(err) },
      'archive toggle failed',
    );
    return internalErrorState();
  }
}
