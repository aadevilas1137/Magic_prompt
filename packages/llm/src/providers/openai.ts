import { AppError, ErrorCode } from '@magic-prompt/shared';

import type { LLMProvider, LLMRequest, LLMResponse } from '../types';

/**
 * OpenAI provider — STUB.
 *
 * TODO(phase-4): wire the official `openai` SDK, implement retries / streaming /
 * cost tracking, and emit telemetry to `prompt_logs`.
 */
export class OpenAIProvider implements LLMProvider {
  public readonly name = 'openai' as const;

  public async generate(_req: LLMRequest): Promise<LLMResponse> {
    throw new AppError({
      code: ErrorCode.NOT_IMPLEMENTED,
      message: 'OpenAIProvider.generate is a Phase 1 stub.',
    });
  }
}
