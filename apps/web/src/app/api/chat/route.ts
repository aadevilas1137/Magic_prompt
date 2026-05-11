import { chats, messages as messagesTable } from '@magic-prompt/database';
import { OpenAIProvider } from '@magic-prompt/llm';
import { createLogger } from '@magic-prompt/logger';
import { AppError, ErrorCode, HTTP_STATUS_BY_CODE, isAppError } from '@magic-prompt/shared';
import { and, asc, eq } from 'drizzle-orm';

import { compactProperties, trackChatEvent } from '@/features/chat/lib/analytics';
import { generateChatTitle, isDefaultTitle } from '@/features/chat/lib/generate-title';
import { ChatRateLimits, checkRateLimit } from '@/features/chat/lib/rate-limit';
import { buildLLMContext } from '@/features/chat/lib/truncate-context';
import { ChatRouteRequestSchema } from '@/features/chat/lib/validation';
import { getUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 60;
// Vercel Hobby caps function timeout at 10s; the chat surface deploys to
// Pro/Enterprise at launch (see PHASE_3_REPORT.md §"Known limits").

const log = createLogger('api:chat');

/**
 * POST /api/chat — streaming chat completion.
 *
 * Flow (in strict order):
 *   1. Auth via getUser() → 401 if anon
 *   2. Zod-parse request body → 400 on shape errors
 *   3. Verify chat ownership via Drizzle → 403 on cross-user attempts, 404 on missing
 *   4. Load last N persisted messages (CHAT_CONTEXT_WINDOW); these are the
 *      authoritative context — never trust the client-sent history blindly.
 *   5. Rate-limit per user (60 sends per 60s) → 429
 *   6. Persist the incoming user message FIRST. If the LLM call fails the
 *      user message still survives + can be retried.
 *   7. Call OpenAIProvider.stream() with onFinish persisting the assistant
 *      message + token/latency metrics. On error, record a partial row.
 *   8. Return the data-stream response that `useChat` consumes.
 *
 * No message content is ever logged. Token counts + model + chat ids are fine.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(
      new AppError({ code: ErrorCode.VALIDATION_ERROR, message: 'Request body must be JSON.' }),
    );
  }

  const parsed = ChatRouteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      new AppError({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Invalid chat request.',
        metadata: { fieldErrors: parsed.error.flatten().fieldErrors },
      }),
    );
  }

  const user = await getUser();
  if (!user) {
    return errorResponse(
      new AppError({ code: ErrorCode.UNAUTHORIZED, message: 'Sign in to chat.' }),
    );
  }

  const { chatId, messages: clientMessages } = parsed.data;

  // Rate limit per user — chat sends are the primary cost driver.
  const rl = checkRateLimit('sendMessage', user.id, ChatRateLimits.sendMessage);
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({
        code: ErrorCode.RATE_LIMITED,
        message: `Too many messages. Try again in ${rl.retryAfterSeconds}s.`,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rl.retryAfterSeconds),
        },
      },
    );
  }

  const db = getDb();

  // Verify chat ownership (authoritative — RLS is the safety net, this is the gate).
  const chatRow = await db
    .select({
      id: chats.id,
      title: chats.title,
    })
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, user.id)))
    .limit(1);

  if (chatRow.length === 0) {
    return errorResponse(new AppError({ code: ErrorCode.NOT_FOUND, message: 'Chat not found.' }));
  }
  const currentTitle = chatRow[0]!.title;

  const lastClient = clientMessages[clientMessages.length - 1];
  if (!lastClient || lastClient.role !== 'user') {
    return errorResponse(
      new AppError({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Last message in payload must be a user message.',
      }),
    );
  }
  if (lastClient.content.length > env.CHAT_MAX_MESSAGE_LENGTH) {
    return errorResponse(
      new AppError({
        code: ErrorCode.VALIDATION_ERROR,
        message: `Message too long (max ${env.CHAT_MAX_MESSAGE_LENGTH} characters).`,
      }),
    );
  }

  // Persist the user message before the LLM call so it survives any failure.
  await db.insert(messagesTable).values({
    chatId,
    role: 'user',
    content: lastClient.content,
  });
  trackChatEvent({
    distinctId: user.id,
    event: 'message.sent',
    properties: compactProperties({
      chatId,
      messageLength: lastClient.content.length,
      isFirstMessage: clientMessages.filter((m) => m.role === 'user').length === 1,
    }),
  });

  // Authoritative context — read fresh from DB (don't trust client state).
  const historyRows = await db
    .select({
      role: messagesTable.role,
      content: messagesTable.content,
      error: messagesTable.error,
    })
    .from(messagesTable)
    .where(eq(messagesTable.chatId, chatId))
    .orderBy(asc(messagesTable.createdAt), asc(messagesTable.id))
    .limit(env.CHAT_CONTEXT_WINDOW + 5); // small headroom over the window cap

  const context = buildLLMContext(historyRows, env.CHAT_CONTEXT_WINDOW);

  // Spawn the provider on each request — cheap, ensures any env rotation
  // (key, model) takes effect without process restart. Phase 5+ may cache.
  let provider: OpenAIProvider;
  try {
    provider = new OpenAIProvider({ defaultModel: env.OPENAI_MODEL });
  } catch (err) {
    log.error({ err: err instanceof Error ? err.message : String(err) }, 'provider init failed');
    return errorResponse(
      isAppError(err)
        ? err
        : new AppError({
            code: ErrorCode.EXTERNAL_SERVICE_ERROR,
            message: 'AI provider unavailable.',
          }),
    );
  }

  const firstUserMessage = lastClient.content;

  const stream = provider.stream(context, {
    model: env.OPENAI_MODEL,
    onFinish: async ({ text, usage, model, latencyMs, finishReason }) => {
      try {
        await db.insert(messagesTable).values({
          chatId,
          role: 'assistant',
          content: text,
          tokenCount: usage.completionTokens,
          model,
          latencyMs,
        });

        // Stamp the chat's last-used model for future-resume UX hints.
        await db
          .update(chats)
          .set({ model, updatedAt: new Date() })
          .where(and(eq(chats.id, chatId), eq(chats.userId, user.id)));

        trackChatEvent({
          distinctId: user.id,
          event: 'message.received',
          properties: compactProperties({
            chatId,
            tokenCount: usage.completionTokens,
            promptTokens: usage.promptTokens,
            totalTokens: usage.totalTokens,
            model,
            latencyMs,
            finishReason,
          }),
        });

        // Trigger title generation after the first exchange (async, non-blocking).
        if (isDefaultTitle(currentTitle)) {
          void generateChatTitle({
            userId: user.id,
            chatId,
            currentTitle,
            firstUserMessage,
            firstAssistantMessage: text,
          });
        }
      } catch (persistErr) {
        log.error(
          {
            chatId,
            err: persistErr instanceof Error ? persistErr.message : String(persistErr),
          },
          'persist assistant message failed',
        );
      }
    },
    onError: async (err) => {
      // Stream-mid failure. Record a partial-error row so the UI can show a retry.
      log.warn({ chatId, err: err instanceof Error ? err.message : String(err) }, 'stream errored');
      try {
        await db.insert(messagesTable).values({
          chatId,
          role: 'assistant',
          content: '',
          error: err instanceof Error ? err.message.slice(0, 500) : 'stream error',
          model: env.OPENAI_MODEL,
        });
      } catch {
        // best-effort
      }
      trackChatEvent({
        distinctId: user.id,
        event: 'message.failed',
        properties: compactProperties({
          chatId,
          errorCode: 'STREAM_ERROR',
        }),
      });
    },
  });

  return stream.toDataStreamResponse();
}

function errorResponse(err: AppError): Response {
  return new Response(
    JSON.stringify({
      code: err.code,
      message: err.message,
      ...(err.metadata !== undefined && { details: err.metadata }),
    }),
    {
      status: HTTP_STATUS_BY_CODE[err.code],
      headers: { 'Content-Type': 'application/json' },
    },
  );
}
