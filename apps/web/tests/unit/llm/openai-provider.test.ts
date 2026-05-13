/**
 * OpenAI provider unit tests.
 *
 * Why these live in `apps/web/tests/unit/llm/` (not `packages/llm/tests/`):
 *   The `@magic-prompt/llm` package has no vitest setup of its own; adding
 *   one means a new config + dep + turbo task per package. We co-locate
 *   here to leverage the existing vitest infra. Documented as Deviation #1
 *   in PHASE_3_REPORT.md.
 *
 * No real OpenAI API calls. Both `generateText` and `streamText` are mocked.
 */
import { OpenAIProvider, mapOpenAIError, type LLMMessage } from '@magic-prompt/llm';
import { AppError, ErrorCode } from '@magic-prompt/shared';
import { APICallError } from 'ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('ai', async () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return {
    ...actual,
    generateText: vi.fn(),
    streamText: vi.fn(),
  };
});

// `createOpenAI()` returns a callable factory; the provider then calls it
// like `sdk(modelId)`. We don't care about the return value (it's just an
// opaque model identifier the AI SDK pipes around) — a plain function works.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fakeSdk: any = (modelId: string) => ({ modelId });

const emptyTokenDetails = {
  noCacheTokens: undefined,
  cacheReadTokens: undefined,
  cacheWriteTokens: undefined,
  reasoningTokens: undefined,
  textTokens: undefined,
  audioTokens: undefined,
  imageTokens: undefined,
  videoTokens: undefined,
};

describe('OpenAIProvider', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    delete process.env['OPENAI_API_KEY'];
    delete process.env['OPENAI_MODEL'];
  });

  describe('construction', () => {
    it('throws AppError when no API key is provided and env is empty', () => {
      delete process.env['OPENAI_API_KEY'];
      expect(() => new OpenAIProvider()).toThrow(AppError);
    });

    it('throws AppError when API key is too short', () => {
      expect(() => new OpenAIProvider({ apiKey: 'sk-tooshort' })).toThrow(AppError);
    });

    it('accepts a valid-length API key', () => {
      const provider = new OpenAIProvider({ apiKey: 'sk-aaaaaaaaaaaaaaaaaaaa' });
      expect(provider.name).toBe('openai');
    });

    it('uses injected sdk when provided (bypasses env check)', () => {
      delete process.env['OPENAI_API_KEY'];
      const provider = new OpenAIProvider({ sdk: fakeSdk });
      expect(provider.name).toBe('openai');
    });

    it('reads default model from OPENAI_MODEL env var', async () => {
      const { generateText } = await import('ai');
      vi.mocked(generateText).mockResolvedValueOnce({
        text: 'ok',
        usage: {
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
          inputTokenDetails: emptyTokenDetails,
          outputTokenDetails: emptyTokenDetails,
        },
        finishReason: 'stop',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      process.env['OPENAI_MODEL'] = 'gpt-4o-from-env';
      const provider = new OpenAIProvider({ sdk: fakeSdk });
      await provider.generate(MSGS);
      expect(vi.mocked(generateText).mock.calls[0]![0].model).toEqual({
        modelId: 'gpt-4o-from-env',
      });
    });
  });

  describe('generate()', () => {
    it('forwards messages, model, temperature, maxTokens to the SDK', async () => {
      const { generateText } = await import('ai');
      vi.mocked(generateText).mockResolvedValueOnce({
        text: 'Hello world',
        usage: {
          inputTokens: 10,
          outputTokens: 7,
          totalTokens: 17,
          inputTokenDetails: emptyTokenDetails,
          outputTokenDetails: emptyTokenDetails,
        },
        finishReason: 'stop',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const provider = new OpenAIProvider({ sdk: fakeSdk });
      const response = await provider.generate(MSGS, {
        model: 'gpt-4o-mini',
        temperature: 0.2,
        maxTokens: 256,
      });

      expect(response.content).toBe('Hello world');
      expect(response.usage).toEqual({
        promptTokens: 10,
        completionTokens: 7,
        totalTokens: 17,
      });
      expect(response.model).toBe('gpt-4o-mini');
      expect(response.finishReason).toBe('stop');
      expect(response.latencyMs).toBeGreaterThanOrEqual(0);

      const callArgs = vi.mocked(generateText).mock.calls[0]![0];
      expect(callArgs.model).toEqual({ modelId: 'gpt-4o-mini' });
      expect(callArgs.temperature).toBe(0.2);
      expect(callArgs.maxOutputTokens).toBe(256);
      expect(callArgs.messages).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ]);
    });

    it('defaults totalTokens to input+output when missing from response', async () => {
      const { generateText } = await import('ai');
      vi.mocked(generateText).mockResolvedValueOnce({
        text: 'x',
        usage: {
          inputTokens: 3,
          outputTokens: 4,
          totalTokens: undefined,
          inputTokenDetails: emptyTokenDetails,
          outputTokenDetails: emptyTokenDetails,
        },
        finishReason: 'stop',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const provider = new OpenAIProvider({ sdk: fakeSdk });
      const response = await provider.generate(MSGS);
      expect(response.usage.totalTokens).toBe(7);
    });

    it('maps APICallError 429 to RATE_LIMITED', async () => {
      const { generateText } = await import('ai');
      vi.mocked(generateText).mockRejectedValueOnce(buildAPICallError(429, ''));

      const provider = new OpenAIProvider({ sdk: fakeSdk });
      await expect(provider.generate(MSGS)).rejects.toMatchObject({
        code: ErrorCode.RATE_LIMITED,
      });
    });

    it('maps APICallError 401 to EXTERNAL_SERVICE_ERROR with key-revoked message', async () => {
      const { generateText } = await import('ai');
      vi.mocked(generateText).mockRejectedValueOnce(buildAPICallError(401, 'invalid_api_key'));

      const provider = new OpenAIProvider({ sdk: fakeSdk });
      const err = await provider.generate(MSGS).catch((e: unknown) => e as AppError);
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe(ErrorCode.EXTERNAL_SERVICE_ERROR);
      expect((err as AppError).message).toMatch(/key/i);
    });

    it('maps context_length_exceeded to VALIDATION_ERROR', async () => {
      const { generateText } = await import('ai');
      vi.mocked(generateText).mockRejectedValueOnce(
        buildAPICallError(400, 'context_length_exceeded: too many tokens'),
      );

      const provider = new OpenAIProvider({ sdk: fakeSdk });
      await expect(provider.generate(MSGS)).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_ERROR,
      });
    });

    it('maps 5xx APICallError to EXTERNAL_SERVICE_ERROR', async () => {
      const { generateText } = await import('ai');
      vi.mocked(generateText).mockRejectedValueOnce(buildAPICallError(503, 'server error'));

      const provider = new OpenAIProvider({ sdk: fakeSdk });
      await expect(provider.generate(MSGS)).rejects.toMatchObject({
        code: ErrorCode.EXTERNAL_SERVICE_ERROR,
      });
    });

    it('maps AbortError to TIMEOUT', async () => {
      const { generateText } = await import('ai');
      const abortErr = new Error('Aborted');
      abortErr.name = 'AbortError';
      vi.mocked(generateText).mockRejectedValueOnce(abortErr);

      const provider = new OpenAIProvider({ sdk: fakeSdk });
      await expect(provider.generate(MSGS)).rejects.toMatchObject({
        code: ErrorCode.TIMEOUT,
      });
    });

    it('passes through AppError unchanged (rethrow path)', async () => {
      const { generateText } = await import('ai');
      const original = new AppError({ code: ErrorCode.VALIDATION_ERROR, message: 'preexisting' });
      vi.mocked(generateText).mockRejectedValueOnce(original);

      const provider = new OpenAIProvider({ sdk: fakeSdk });
      await expect(provider.generate(MSGS)).rejects.toBe(original);
    });

    it('wraps unknown errors as EXTERNAL_SERVICE_ERROR (never leaks)', async () => {
      const { generateText } = await import('ai');
      vi.mocked(generateText).mockRejectedValueOnce(new Error('mystery'));

      const provider = new OpenAIProvider({ sdk: fakeSdk });
      const err = await provider.generate(MSGS).catch((e: unknown) => e as AppError);
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe(ErrorCode.EXTERNAL_SERVICE_ERROR);
    });
  });

  describe('stream()', () => {
    it('returns an LLMStreamResult and forwards onFinish with normalised usage', async () => {
      const { streamText } = await import('ai');
      const onFinishCapture = vi.fn();

      vi.mocked(streamText).mockImplementationOnce((opts) => {
        // Simulate the SDK calling onFinish after stream completion.
        setTimeout(() => {
          void opts.onFinish?.({
            text: 'streamed-text',
            usage: {
              inputTokens: 5,
              outputTokens: 9,
              totalTokens: 14,
              inputTokenDetails: emptyTokenDetails,
              outputTokenDetails: emptyTokenDetails,
            },
            finishReason: 'stop',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);
        }, 0);
        return {
          toUIMessageStreamResponse: () => new Response('streamed'),
          textStream: (async function* () {
            yield 'streamed-text';
          })(),
        } as unknown as ReturnType<typeof streamText>;
      });

      const provider = new OpenAIProvider({ sdk: fakeSdk });
      const result = provider.stream(MSGS, { onFinish: onFinishCapture });
      expect(typeof result.toDataStreamResponse).toBe('function');
      expect(typeof result.toTextStream).toBe('function');
      expect(result.toDataStreamResponse()).toBeInstanceOf(Response);

      // Allow the async onFinish callback to fire.
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(onFinishCapture).toHaveBeenCalledTimes(1);
      expect(onFinishCapture.mock.calls[0]![0]).toMatchObject({
        text: 'streamed-text',
        usage: { promptTokens: 5, completionTokens: 9, totalTokens: 14 },
        finishReason: 'stop',
      });
    });

    it('forwards onError to caller', async () => {
      const { streamText } = await import('ai');
      const onErrorCapture = vi.fn();

      vi.mocked(streamText).mockImplementationOnce((opts) => {
        setTimeout(() => {
          void opts.onError?.({ error: new Error('network bonked') });
        }, 0);
        return {
          toUIMessageStreamResponse: () => new Response('err'),
          textStream: (async function* () {})(),
        } as unknown as ReturnType<typeof streamText>;
      });

      const provider = new OpenAIProvider({ sdk: fakeSdk });
      provider.stream(MSGS, { onError: onErrorCapture });
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(onErrorCapture).toHaveBeenCalledTimes(1);
      expect(onErrorCapture.mock.calls[0]![0]).toBeInstanceOf(Error);
    });
  });

  describe('mapOpenAIError', () => {
    it('returns the AppError as-is if input is already an AppError', () => {
      const original = new AppError({ code: ErrorCode.NOT_FOUND, message: 'x' });
      expect(mapOpenAIError(original)).toBe(original);
    });

    it('wraps an arbitrary string as EXTERNAL_SERVICE_ERROR', () => {
      const err = mapOpenAIError('plain string');
      expect(err.code).toBe(ErrorCode.EXTERNAL_SERVICE_ERROR);
    });
  });
});

const MSGS: readonly LLMMessage[] = [
  { role: 'user', content: 'Hello' },
  { role: 'assistant', content: 'Hi there!' },
];

function buildAPICallError(status: number, body: string): APICallError {
  return new APICallError({
    message: `OpenAI ${status}`,
    url: 'https://api.openai.com/v1/chat/completions',
    requestBodyValues: {},
    statusCode: status,
    responseHeaders: {},
    responseBody: body,
    cause: undefined,
    isRetryable: status >= 500,
    data: undefined,
  });
}
