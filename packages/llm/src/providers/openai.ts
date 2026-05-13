import { createOpenAI, type OpenAIProvider as AISdkOpenAI } from '@ai-sdk/openai';
import { AppError, ErrorCode } from '@magic-prompt/shared';
import {
  generateText,
  streamText,
  APICallError,
  type ModelMessage,
  type LanguageModelUsage,
} from 'ai';

import type {
  GenerateOptions,
  LLMMessage,
  LLMProvider,
  LLMResponse,
  LLMStreamResult,
  LLMUsage,
  StreamOptions,
} from '../types';

const DEFAULT_MODEL = 'gpt-4o';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 2;

export interface OpenAIProviderOptions {
  /** OpenAI API key — defaults to `process.env.OPENAI_API_KEY`. */
  readonly apiKey?: string;
  /** Default model used when a request doesn't specify one. */
  readonly defaultModel?: string;
  /** Injection seam for tests — lets the unit suite swap the SDK factory. */
  readonly sdk?: AISdkOpenAI;
}

/**
 * OpenAI provider built on top of the Vercel AI SDK (v6).
 *
 * Two responsibilities:
 *   - `generate()` for non-streaming calls (title generation, evals).
 *   - `stream()` for token-by-token responses delivered through `/api/chat`.
 *
 * Error mapping (AI SDK → `AppError`):
 *   - 401 / `invalid_api_key`             → EXTERNAL_SERVICE_ERROR  (alert)
 *   - 429 / rate-limit                    → RATE_LIMITED
 *   - 4xx / `context_length_exceeded`     → VALIDATION_ERROR
 *   - 4xx / other                         → EXTERNAL_SERVICE_ERROR
 *   - 5xx / network / timeout             → EXTERNAL_SERVICE_ERROR  (retried)
 *
 * The AI SDK's `maxRetries` handles transient 5xx + network errors transparently.
 * We pass through `timeoutMs` via `AbortSignal.timeout()` so the chat route
 * stays inside its serverless function budget.
 */
export class OpenAIProvider implements LLMProvider {
  public readonly name = 'openai' as const;
  private readonly sdk: AISdkOpenAI;
  private readonly defaultModel: string;

  public constructor(opts: OpenAIProviderOptions = {}) {
    if (opts.sdk) {
      this.sdk = opts.sdk;
    } else {
      const apiKey = opts.apiKey ?? process.env['OPENAI_API_KEY'];
      if (!apiKey || apiKey.length < 20) {
        throw new AppError({
          code: ErrorCode.EXTERNAL_SERVICE_ERROR,
          message:
            'OpenAIProvider: OPENAI_API_KEY missing or malformed. Set it in apps/web/.env.local.',
        });
      }
      this.sdk = createOpenAI({ apiKey });
    }
    this.defaultModel = opts.defaultModel ?? process.env['OPENAI_MODEL'] ?? DEFAULT_MODEL;
  }

  public async generate(
    messages: readonly LLMMessage[],
    options: GenerateOptions = {},
  ): Promise<LLMResponse> {
    const modelId = options.model ?? this.defaultModel;
    const signal = composeSignal(options.signal, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const start = Date.now();

    try {
      const result = await generateText({
        model: this.sdk(modelId),
        messages: toModelMessages(messages),
        ...(options.temperature !== undefined && { temperature: options.temperature }),
        ...(options.maxTokens !== undefined && { maxOutputTokens: options.maxTokens }),
        maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
        ...(signal && { abortSignal: signal }),
      });
      return {
        content: result.text,
        model: modelId,
        usage: normaliseUsage(result.usage),
        finishReason: result.finishReason,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      throw mapOpenAIError(err);
    }
  }

  public stream(messages: readonly LLMMessage[], options: StreamOptions = {}): LLMStreamResult {
    const modelId = options.model ?? this.defaultModel;
    const signal = composeSignal(options.signal, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const start = Date.now();

    const result = streamText({
      model: this.sdk(modelId),
      messages: toModelMessages(messages),
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(options.maxTokens !== undefined && { maxOutputTokens: options.maxTokens }),
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
      ...(signal && { abortSignal: signal }),
      onFinish: async (event) => {
        if (!options.onFinish) return;
        await options.onFinish({
          text: event.text,
          model: modelId,
          usage: normaliseUsage(event.usage),
          finishReason: event.finishReason,
          latencyMs: Date.now() - start,
        });
      },
      onError: async (event) => {
        if (!options.onError) return;
        await options.onError(event.error);
      },
    });

    return {
      toDataStreamResponse: () => result.toUIMessageStreamResponse(),
      toTextStream: () => result.textStream as AsyncIterable<string>,
    };
  }
}

function toModelMessages(messages: readonly LLMMessage[]): ModelMessage[] {
  return messages.map((m) => ({ role: m.role, content: m.content }) as ModelMessage);
}

function normaliseUsage(usage: LanguageModelUsage): LLMUsage {
  const input = usage.inputTokens ?? 0;
  const output = usage.outputTokens ?? 0;
  return {
    promptTokens: input,
    completionTokens: output,
    totalTokens: usage.totalTokens ?? input + output,
  };
}

function composeSignal(
  externalSignal: AbortSignal | undefined,
  timeoutMs: number,
): AbortSignal | undefined {
  if (timeoutMs <= 0 && !externalSignal) return undefined;
  const timeoutSignal = timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined;
  if (externalSignal && timeoutSignal) {
    if (typeof AbortSignal.any === 'function') {
      return AbortSignal.any([externalSignal, timeoutSignal]);
    }
    const controller = new AbortController();
    const abort = (): void => controller.abort();
    externalSignal.addEventListener('abort', abort, { once: true });
    timeoutSignal.addEventListener('abort', abort, { once: true });
    return controller.signal;
  }
  return externalSignal ?? timeoutSignal;
}

/**
 * Map AI SDK / OpenAI errors to AppError codes. Conservative — when in doubt
 * we route to EXTERNAL_SERVICE_ERROR (502) which the chat route presents with
 * a "try again" CTA rather than blaming the user.
 */
export function mapOpenAIError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (APICallError.isInstance(err)) {
    const status = err.statusCode;
    const body = err.responseBody ?? '';
    const lowerBody = body.toLowerCase();

    if (lowerBody.includes('context_length_exceeded') || lowerBody.includes('context window')) {
      return new AppError({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Conversation is too long for the model. Start a new chat or shorten the context.',
        cause: err,
        metadata: { provider: 'openai', upstreamStatus: status },
      });
    }
    if (status === 401 || lowerBody.includes('invalid_api_key')) {
      return new AppError({
        code: ErrorCode.EXTERNAL_SERVICE_ERROR,
        message: 'OpenAI rejected the API key. Verify OPENAI_API_KEY is correct and not revoked.',
        cause: err,
        metadata: { provider: 'openai', upstreamStatus: status },
      });
    }
    if (status === 429 || lowerBody.includes('rate_limit')) {
      return new AppError({
        code: ErrorCode.RATE_LIMITED,
        message: 'AI provider rate limit hit. Please wait a moment and retry.',
        cause: err,
        metadata: { provider: 'openai', upstreamStatus: status },
      });
    }
    if (status !== undefined && status >= 500) {
      return new AppError({
        code: ErrorCode.EXTERNAL_SERVICE_ERROR,
        message: 'AI provider is having trouble responding. Please retry.',
        cause: err,
        metadata: { provider: 'openai', upstreamStatus: status },
      });
    }
    return new AppError({
      code: ErrorCode.EXTERNAL_SERVICE_ERROR,
      message: 'AI provider returned an error. Please retry.',
      cause: err,
      metadata: { provider: 'openai', upstreamStatus: status },
    });
  }

  if (err instanceof Error && err.name === 'AbortError') {
    return new AppError({
      code: ErrorCode.TIMEOUT,
      message: 'AI request timed out. Please retry.',
      cause: err,
      metadata: { provider: 'openai' },
    });
  }

  return new AppError({
    code: ErrorCode.EXTERNAL_SERVICE_ERROR,
    message: 'Unexpected error talking to OpenAI.',
    cause: err,
    metadata: { provider: 'openai' },
  });
}
