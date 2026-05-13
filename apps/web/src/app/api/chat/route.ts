import { chats, messages as messagesTable } from '@magic-prompt/database';
import { runIPE, type IPEConfig, type IPEInput, type IPEResult } from '@magic-prompt/ipe';
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

const log = createLogger('api:chat');

/**
 * POST /api/chat — streaming chat completion with optional IPE.
 *
 * Flow:
 *   1. Auth + Zod + chat ownership + rate-limit + persist user message (Phase 3 baseline).
 *   2. If `env.IPE_ENABLED`:
 *      - Run the 5-layer IPE pipeline (Layers 1-3 ~1.5s).
 *      - On any throw + `env.IPE_FALLBACK_ON_ERROR=true`, fall back to Phase 3 path.
 *      - The user's UI is identical either way — the magic prompt NEVER reaches the wire.
 *   3. Stream the LLM response (Layer 4 = OpenAIProvider.stream).
 *   4. In `onFinish`, persist assistant message + call `ipeResult.onStreamComplete()`
 *      which runs Layer 5 (quality validation) and writes the prompt_logs row.
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

  // Persist the user message — capture id for downstream IPE messageId.
  const [persistedUserMessage] = await db
    .insert(messagesTable)
    .values({ chatId, role: 'user', content: lastClient.content })
    .returning({ id: messagesTable.id });

  if (!persistedUserMessage) {
    return errorResponse(
      new AppError({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to persist user message.',
      }),
    );
  }

  trackChatEvent({
    distinctId: user.id,
    event: 'message.sent',
    properties: compactProperties({
      chatId,
      messageLength: lastClient.content.length,
      isFirstMessage: clientMessages.filter((m) => m.role === 'user').length === 1,
    }),
  });

  // Authoritative history — read fresh from DB.
  const historyRows = await db
    .select({
      role: messagesTable.role,
      content: messagesTable.content,
      error: messagesTable.error,
    })
    .from(messagesTable)
    .where(eq(messagesTable.chatId, chatId))
    .orderBy(asc(messagesTable.createdAt), asc(messagesTable.id))
    .limit(env.CHAT_CONTEXT_WINDOW + 5);

  // -------- IPE plug-in point --------
  let ipeResult: IPEResult | null = null;
  let context;
  if (env.IPE_ENABLED && env.DATABASE_URL) {
    const ipeInput: IPEInput = {
      userMessage: lastClient.content,
      history: historyRows,
      userId: user.id,
      chatId,
      messageId: persistedUserMessage.id,
    };
    const ipeConfig: IPEConfig = {
      openAIApiKey: env.OPENAI_API_KEY,
      intentModel: env.OPENAI_TITLE_MODEL,
      classifierModel: env.OPENAI_TITLE_MODEL,
      judgeModel: env.OPENAI_TITLE_MODEL,
      intentTimeoutMs: env.IPE_INTENT_TIMEOUT_MS,
      classifierTimeoutMs: env.IPE_CLASSIFIER_TIMEOUT_MS,
      qualitySampleRate: env.IPE_QUALITY_SAMPLE_RATE,
      pipelineVersion: env.IPE_PIPELINE_VERSION,
    };
    try {
      ipeResult = await runIPE({
        input: ipeInput,
        config: ipeConfig,
        dbConnectionString: env.DATABASE_URL,
      });
      context = ipeResult.messages;
    } catch (err) {
      log.error(
        { chatId, err: err instanceof Error ? err.message : String(err) },
        'IPE pipeline threw — deciding fallback',
      );
      if (env.IPE_FALLBACK_ON_ERROR) {
        log.warn({ chatId }, 'IPE_FALLBACK_ON_ERROR=true → using Phase 3 raw LLM path');
        ipeResult = null;
        context = buildLLMContext(historyRows, env.CHAT_CONTEXT_WINDOW);
      } else {
        return errorResponse(
          isAppError(err)
            ? err
            : new AppError({
                code: ErrorCode.EXTERNAL_SERVICE_ERROR,
                message: 'IPE pipeline failed and fallback is disabled.',
              }),
        );
      }
    }
  } else {
    context = buildLLMContext(historyRows, env.CHAT_CONTEXT_WINDOW);
  }

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

        // Layer 5 + prompt_logs persist (best-effort, after assistant row is saved).
        if (ipeResult) {
          try {
            await ipeResult.onStreamComplete({
              assistantContent: text,
              llmUsed: `openai:${model}`,
            });
          } catch (ipeErr) {
            log.error(
              { chatId, err: ipeErr instanceof Error ? ipeErr.message : String(ipeErr) },
              'IPE onStreamComplete threw (telemetry lost; user flow unaffected)',
            );
          }
        }

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
