import {
  OpenAIProvider,
  type LLMMessage,
  type LLMStreamResult,
  type StreamOptions,
} from '@magic-prompt/llm';

import { ipeLogger } from '../lib/logger';

import type { IPEInput } from '../types';

const log = ipeLogger.child({ layer: 'execute' });

export interface Layer4Options {
  readonly apiKey: string;
  readonly model: string;
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  readonly onFinish?: NonNullable<StreamOptions['onFinish']>;
  readonly onError?: NonNullable<StreamOptions['onError']>;
  readonly signal?: AbortSignal;
}

/**
 * Layer 4 — execute the magic prompt against the LLM and return a stream.
 *
 * In Phase 4 there's only one provider (OpenAI GPT-4o); Phase 8 introduces
 * the real LLMRouter with domain-aware routing. This wrapper exists so
 * `/api/chat` doesn't import `@magic-prompt/llm` directly for IPE calls —
 * keeps the seam clean for Phase 8.
 */
export function runLayer4Execute(
  messages: readonly LLMMessage[],
  opts: Layer4Options,
  _ipeInput: Pick<IPEInput, 'userId' | 'chatId' | 'messageId'>,
): LLMStreamResult {
  log.debug(
    { model: opts.model, messageCount: messages.length, temperature: opts.temperature ?? 0.7 },
    'streaming magic prompt to LLM',
  );

  const provider = new OpenAIProvider({ apiKey: opts.apiKey, defaultModel: opts.model });
  return provider.stream(messages, {
    model: opts.model,
    temperature: opts.temperature ?? 0.7,
    maxTokens: opts.maxOutputTokens ?? 4000,
    ...(opts.onFinish && { onFinish: opts.onFinish }),
    ...(opts.onError && { onError: opts.onError }),
    ...(opts.signal && { signal: opts.signal }),
  });
}
