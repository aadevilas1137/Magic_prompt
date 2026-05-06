import { AppError, ErrorCode } from '@magic-prompt/shared';

import type { IPEInput, IPEOutput } from './types';

export interface IPEPipeline {
  execute(input: IPEInput): Promise<IPEOutput>;
}

/**
 * Iterative Prompt Engineering pipeline — STUB.
 *
 * TODO(phase-4..phase-7): orchestrate the seven IPE layers (parse → classify →
 * enrich → rewrite → critique → refine → finalize) over an LLM router.
 */
export class StubIPEPipeline implements IPEPipeline {
  public async execute(_input: IPEInput): Promise<IPEOutput> {
    throw new AppError({
      code: ErrorCode.NOT_IMPLEMENTED,
      message: 'IPEPipeline.execute is a Phase 1 stub.',
    });
  }
}
