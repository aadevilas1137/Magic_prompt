/**
 * Chat-shaped message — matches OpenAI / Anthropic / AI SDK conventions.
 * The provider implementations forward these directly to the underlying SDK.
 */
export interface LLMMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

/**
 * Token usage reported by the provider after a generation.
 * Names mirror OpenAI's billing model (prompt + completion) and stay stable
 * across providers via the AI SDK's normalised `usage` object.
 */
export interface LLMUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

/**
 * Common knobs supported by every provider. Anything provider-specific should
 * be threaded through via `metadata` (best-effort, not guaranteed honored).
 */
export interface GenerateOptions {
  readonly model?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly signal?: AbortSignal;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface LLMResponse {
  readonly content: string;
  readonly model: string;
  readonly usage: LLMUsage;
  readonly finishReason: string;
  readonly latencyMs: number;
}

/**
 * Emitted once when a stream finishes (success or terminal error). Used by
 * the chat route handler to persist the final assistant message to the DB
 * via Drizzle.
 */
export interface StreamFinishEvent {
  readonly text: string;
  readonly model: string;
  readonly usage: LLMUsage;
  readonly finishReason: string;
  readonly latencyMs: number;
}

export interface StreamOptions extends GenerateOptions {
  /**
   * Fired exactly once when the stream finishes. The caller uses this to
   * persist the final assistant message + token metrics. Throwing inside
   * `onFinish` is caught by the AI SDK and surfaced as a stream error;
   * callers should never use it for user-facing fail paths.
   */
  readonly onFinish?: (event: StreamFinishEvent) => void | Promise<void>;
  /**
   * Fired if the stream itself errors (network, provider 5xx, abort). The
   * route uses this to record the partial message + error to the DB.
   */
  readonly onError?: (err: unknown) => void | Promise<void>;
}

/**
 * Provider-shaped streaming result. Wraps the AI SDK's `StreamTextResult`
 * so consumers don't import directly from `ai`. Exposes:
 *   - `toDataStreamResponse()` — the Response returned by the route handler.
 *   - `toTextStream()` — an `AsyncIterable<string>` for non-HTTP callers.
 * Phase 5+ may swap the underlying SDK; this surface stays stable.
 */
export interface LLMStreamResult {
  toDataStreamResponse(): Response;
  toTextStream(): AsyncIterable<string>;
}

export interface LLMProvider {
  readonly name: ProviderName;
  /** One-shot synchronous generation. Used by title-generation, evals, etc. */
  generate(messages: readonly LLMMessage[], options?: GenerateOptions): Promise<LLMResponse>;
  /** Streamed generation. Returned object is consumed by the route handler. */
  stream(messages: readonly LLMMessage[], options?: StreamOptions): LLMStreamResult;
}

export type ProviderName = 'openai' | 'anthropic' | 'google';
