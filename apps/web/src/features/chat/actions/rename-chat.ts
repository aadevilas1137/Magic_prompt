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
import { RenameChatSchema } from '@/features/chat/lib/validation';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';

const log = chatLogger.child({ action: 'rename-chat' });

export async function renameChatAction(input: {
  readonly chatId: string;
  readonly title: string;
}): Promise<ChatActionState> {
  const user = await requireUser('/chat');

  const parsed = RenameChatSchema.safeParse(input);
  if (!parsed.success) return fieldErrorState(parsed, 'Invalid chat title.');

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
      .set({ title: parsed.data.title, updatedAt: new Date() })
      .where(and(eq(chats.id, parsed.data.chatId), eq(chats.userId, user.id)))
      .returning({ id: chats.id });

    if (updated.length === 0) return notFoundState();

    log.info({ userId: user.id, chatId: parsed.data.chatId }, 'chat renamed');
    trackChatEvent({
      distinctId: user.id,
      event: 'chat.renamed',
      properties: compactProperties({
        userId: user.id,
        chatId: parsed.data.chatId,
        hadCustomTitle: true,
      }),
    });

    revalidatePath('/chat');
    return { status: 'success', chatId: parsed.data.chatId };
  } catch (err) {
    log.error(
      { userId: user.id, err: err instanceof Error ? err.message : String(err) },
      'rename failed',
    );
    return internalErrorState();
  }
}
