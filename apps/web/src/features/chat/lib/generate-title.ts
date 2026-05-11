import 'server-only';

import { chats } from '@magic-prompt/database';
import { OpenAIProvider } from '@magic-prompt/llm';
import { createLogger } from '@magic-prompt/logger';
import { and, eq } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { env } from '@/lib/env';

const log = createLogger('chat:generate-title');

const TITLE_PROMPT_SYSTEM =
  'Generate a 3-6 word title for this conversation. ' +
  'Be concise, descriptive, no quotes, no trailing punctuation, no markdown.';

const FIRST_PROMPT_MAX_CHARS = 500;
const FIRST_RESPONSE_MAX_CHARS = 500;
const TITLE_MAX_CHARS = 80;

export interface GenerateTitleInput {
  readonly userId: string;
  readonly chatId: string;
  readonly currentTitle: string;
  readonly firstUserMessage: string;
  readonly firstAssistantMessage: string;
}

/**
 * Fire-and-forget title generation. Called from the `/api/chat` route's
 * `onFinish` callback after the first user-assistant exchange completes.
 *
 * Behavior:
 *   - Skips if the chat already has a custom title (not "New chat" / empty).
 *   - Uses the cheap title model (`gpt-4o-mini` by default; see env).
 *   - Updates `chats.title` via Drizzle with explicit user+chat filter.
 *   - Silent failure (logs warn). The chat keeps its previous title on error.
 *
 * Token budget: ~1200 tokens (capped via slice). Cost ≈ $0.0001 / title.
 */
export async function generateChatTitle(input: GenerateTitleInput): Promise<void> {
  if (!isDefaultTitle(input.currentTitle)) {
    log.debug(
      { chatId: input.chatId, title: input.currentTitle },
      'skip: title already customised',
    );
    return;
  }

  const start = Date.now();
  try {
    const provider = new OpenAIProvider({
      defaultModel: env.OPENAI_TITLE_MODEL,
    });
    const result = await provider.generate(
      [
        { role: 'system', content: TITLE_PROMPT_SYSTEM },
        {
          role: 'user',
          content: `USER:\n${input.firstUserMessage.slice(0, FIRST_PROMPT_MAX_CHARS)}\n\nASSISTANT:\n${input.firstAssistantMessage.slice(0, FIRST_RESPONSE_MAX_CHARS)}`,
        },
      ],
      { temperature: 0.4, maxTokens: 32, timeoutMs: 15_000, model: env.OPENAI_TITLE_MODEL },
    );

    const cleaned = cleanTitle(result.content);
    if (!cleaned) {
      log.warn({ chatId: input.chatId }, 'title generator returned empty content');
      return;
    }

    const db = getDb();
    await db
      .update(chats)
      .set({ title: cleaned, updatedAt: new Date() })
      .where(and(eq(chats.id, input.chatId), eq(chats.userId, input.userId)));

    log.info(
      { chatId: input.chatId, durationMs: Date.now() - start, title: cleaned },
      'title generated',
    );
  } catch (err) {
    log.warn(
      {
        chatId: input.chatId,
        err: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      },
      'title generation failed (fallback: keep current title)',
    );
  }
}

export function isDefaultTitle(title: string | null | undefined): boolean {
  if (!title) return true;
  const t = title.trim().toLowerCase();
  return t === '' || t === 'new chat';
}

export function cleanTitle(raw: string): string {
  return raw
    .replace(/^[\s"'`]+|[\s"'`.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, TITLE_MAX_CHARS)
    .trim();
}
