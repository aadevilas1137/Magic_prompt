'use server';

import type { Message } from '@magic-prompt/shared';

import { getMessages } from '@/features/chat/queries/get-messages';
import { requireUser } from '@/lib/auth';

export async function listMessagesAction(input: {
  readonly chatId: string;
}): Promise<{ messages: readonly Message[] }> {
  const user = await requireUser('/chat');
  const result = await getMessages({ userId: user.id, chatId: input.chatId });
  return result;
}
