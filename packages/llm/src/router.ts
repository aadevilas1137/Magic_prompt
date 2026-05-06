import { AppError, ErrorCode } from '@magic-prompt/shared';

import type { LLMProvider, LLMRequest, LLMResponse } from './types';

export interface LLMRouter {
  route(req: LLMRequest): Promise<LLMResponse>;
}

/**
 * LLM router — STUB.
 *
 * TODO(phase-5): implement provider selection based on the IPE pipeline output
 * (domain, complexity, cost ceiling, capability requirements). For now this
 * accepts a registry but always rejects with NOT_IMPLEMENTED.
 */
export class StubLLMRouter implements LLMRouter {
  public constructor(private readonly providers: ReadonlyMap<string, LLMProvider>) {}

  public async route(_req: LLMRequest): Promise<LLMResponse> {
    if (this.providers.size === 0) {
      throw new AppError({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'LLMRouter has no providers registered.',
      });
    }
    throw new AppError({
      code: ErrorCode.NOT_IMPLEMENTED,
      message: 'LLMRouter.route is a Phase 1 stub.',
    });
  }
}
