import type { Domain } from '@magic-prompt/shared';

export interface IPEContext {
  readonly userId: string;
  readonly locale?: string;
  readonly domainHint?: Domain;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IPEInput {
  readonly raw: string;
  readonly context: IPEContext;
}

export interface IPEOutput {
  readonly magicPrompt: string;
  readonly domain: Domain;
  readonly complexity: number;
  readonly qualityScore: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * The seven layers of the IPE pipeline.
 * Implementations land in Phases 4–7. Defined here so consumers have stable
 * symbols to reference.
 */
export const IPELayer = {
  PARSE: 'parse',
  CLASSIFY: 'classify',
  ENRICH: 'enrich',
  REWRITE: 'rewrite',
  CRITIQUE: 'critique',
  REFINE: 'refine',
  FINALIZE: 'finalize',
} as const;

export type IPELayer = (typeof IPELayer)[keyof typeof IPELayer];
