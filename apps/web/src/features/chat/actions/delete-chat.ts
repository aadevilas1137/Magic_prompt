'use server';

import { chats, messages } from '@magic-prompt/database';
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

const log = chatLogger.child({ action: 'delete-chat' });

export async function deleteChatAction(input: { chatId: string }): Promise<ChatActionState> {
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

    // Count messages before delete (for analytics; cascade fires automatically).
    const messageRows = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.chatId, parsed.data.chatId));
    const messageCount = messageRows.length;

    const deleted = await db
      .delete(chats)
      .where(and(eq(chats.id, parsed.data.chatId), eq(chats.userId, user.id)))
      .returning({ id: chats.id });

    if (deleted.length === 0) {
      return notFoundState();
    }

    log.info({ userId: user.id, chatId: parsed.data.chatId, messageCount }, 'chat deleted');
    trackChatEvent({
      distinctId: user.id,
      event: 'chat.deleted',
      properties: compactProperties({
        userId: user.id,
        chatId: parsed.data.chatId,
        messageCount,
      }),
    });

    revalidatePath('/chat');
    return { status: 'success', chatId: parsed.data.chatId };
  } catch (err) {
    log.error(
      { userId: user.id, err: err instanceof Error ? err.message : String(err) },
      'delete failed',
    );
    return internalErrorState();
  }
}
