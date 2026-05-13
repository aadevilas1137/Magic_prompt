import { ALL_COMPLEXITIES, ALL_DOMAINS } from '@magic-prompt/shared';
import { z } from 'zod';

import type { ServiceRoleDb } from './lib/service-role-db';
import type { LLMMessage } from '@magic-prompt/llm';
import type { Complexity, Domain } from '@magic-prompt/shared';

/**
 * The 5-layer IPE pipeline transforms a lazy user input into an expert-grade
 * structured prompt without the user ever seeing it.
 *
 *   Layer 1 — Intent Parser
 *   Layer 2 — Domain Classifier + Complexity Scorer
 *   Layer 3 — Magic Prompt Constructor (template-based)
 *   Layer 4 — LLM Router + Streaming Execution
 *   Layer 5 — Quality Validator (post-stream)
 *
 * Stable symbols for instrumentation + debug output.
 */
export const IPELayer = {
  INTENT: 'intent',
  CLASSIFY: 'classify',
  CONSTRUCT: 'construct',
  EXECUTE: 'execute',
  VALIDATE: 'validate',
} as const;

export type IPELayer = (typeof IPELayer)[keyof typeof IPELayer];

// ---------------------------------------------------------------------------
// Layer 1 — Intent Parser
// ---------------------------------------------------------------------------

export const DesiredOutput = {
  PRODUCTION_CODE: 'production_code',
  CONTENT: 'content',
  DOCUMENT: 'document',
  ANALYSIS: 'analysis',
  EXPLANATION: 'explanation',
  RECOMMENDATION: 'recommendation',
  OTHER: 'other',
} as const;

export type DesiredOutput = (typeof DesiredOutput)[keyof typeof DesiredOutput];

export const IntentParserResultSchema = z.object({
  intent: z.string().min(1).max(200),
  implied_context: z.string().max(500),
  desired_output: z.enum([
    DesiredOutput.PRODUCTION_CODE,
    DesiredOutput.CONTENT,
    DesiredOutput.DOCUMENT,
    DesiredOutput.ANALYSIS,
    DesiredOutput.EXPLANATION,
    DesiredOutput.RECOMMENDATION,
    DesiredOutput.OTHER,
  ]),
  missing_params: z.array(z.string().max(120)).max(20),
  confidence: z.number().min(0).max(1),
});

export type IntentParserResult = z.infer<typeof IntentParserResultSchema>;

// ---------------------------------------------------------------------------
// Layer 2 — Domain Classifier
// ---------------------------------------------------------------------------

const domainEnum = z.enum(ALL_DOMAINS as readonly [Domain, ...Domain[]]);
const complexityEnum = z.enum(ALL_COMPLEXITIES as readonly [Complexity, ...Complexity[]]);

export const ClassifierResultSchema = z.object({
  primary_domain: domainEnum,
  secondary_domain: domainEnum.nullable(),
  complexity: complexityEnum,
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(500),
});

export type ClassifierResult = z.infer<typeof ClassifierResultSchema>;

// ---------------------------------------------------------------------------
// Layer 3 — Magic Prompt Constructor
// ---------------------------------------------------------------------------

/**
 * Slot data threaded into a domain template. Stays minimal — anything bigger
 * (full chat history, etc) is handled at the pipeline level, not by templates.
 */
export interface TemplateSlots {
  readonly userMessage: string;
  readonly intent: string;
  readonly impliedContext: string;
  readonly desiredOutput: DesiredOutput;
  readonly missingParams: readonly string[];
  readonly primaryDomain: Domain;
  readonly secondaryDomain: Domain | null;
  readonly complexity: Complexity;
}

/**
 * What every domain template returns. Becomes the LLM messages sent in Layer 4.
 */
export interface MagicPrompt {
  readonly systemMessage: string;
  readonly userMessage: string;
}

export interface DomainTemplate {
  readonly domain: Domain;
  readonly version: string;
  readonly buildPrompt: (slots: TemplateSlots) => MagicPrompt;
}

// ---------------------------------------------------------------------------
// Layer 5 — Quality Validator
// ---------------------------------------------------------------------------

export const QualityMethod = {
  HEURISTIC: 'heuristic',
  LLM_JUDGE: 'llm_judge',
} as const;

export type QualityMethod = (typeof QualityMethod)[keyof typeof QualityMethod];

export interface HeuristicQualityResult {
  readonly score: number;
  readonly method: typeof QualityMethod.HEURISTIC;
  readonly checks: Readonly<Record<string, boolean>>;
  readonly hasPromptLeakage: boolean;
}

export interface LLMJudgeQualityResult {
  readonly score: number;
  readonly method: typeof QualityMethod.LLM_JUDGE;
  readonly reasoning: string;
  readonly checks: Readonly<Record<string, boolean>>;
  readonly hasPromptLeakage: boolean;
}

export type QualityResult = HeuristicQualityResult | LLMJudgeQualityResult;

// ---------------------------------------------------------------------------
// Pipeline-level types
// ---------------------------------------------------------------------------

export interface IPEInput {
  readonly userMessage: string;
  readonly history?: readonly LLMMessage[];
  readonly userId: string;
  readonly chatId: string;
  readonly messageId: string;
  /** Override for tests / Phase 5+ aborts. */
  readonly signal?: AbortSignal;
}

export interface LayerLatenciesMs {
  readonly layer1: number;
  readonly layer2: number;
  readonly layer3: number;
}

export interface IPEMetadata {
  readonly intentJson: IntentParserResult;
  readonly classifierJson: ClassifierResult;
  readonly primaryDomain: Domain;
  readonly secondaryDomain: Domain | null;
  readonly complexityScore: Complexity;
  /** The full constructed prompt — STORED in prompt_logs, NEVER returned to the user. */
  readonly magicPrompt: string;
  readonly pipelineVersion: string;
  readonly layerLatenciesMs: LayerLatenciesMs;
  readonly fallbackUsed: boolean;
}

export interface OnStreamCompletePayload {
  readonly assistantContent: string;
  readonly llmUsed: string;
}

export interface IPEResult {
  /** The LLM messages that replace Phase 3's `buildLLMContext()` output. */
  readonly messages: readonly LLMMessage[];
  /** Metadata persisted to `prompt_logs` after the stream completes. */
  readonly metadata: IPEMetadata;
  /**
   * Run by `/api/chat`'s `onFinish` handler. Runs Layer 5 (quality
   * validator + LLM judge sampling) and inserts the `prompt_logs` row.
   * Fire-and-forget on the route side — `await` it in `onFinish` for
   * tests but don't block stream cleanup on it in prod.
   */
  readonly onStreamComplete: (payload: OnStreamCompletePayload) => Promise<void>;
}

/**
 * Configuration for one `runIPE()` invocation. Defaults to env-driven values
 * in production; tests pass their own overrides.
 */
export interface IPEConfig {
  readonly openAIApiKey: string;
  readonly intentModel: string;
  readonly classifierModel: string;
  readonly judgeModel: string;
  readonly intentTimeoutMs: number;
  readonly classifierTimeoutMs: number;
  readonly qualitySampleRate: number;
  readonly pipelineVersion: string;
  /** Service-role DB handle for prompt_logs writes. Tests inject mocks. */
  readonly serviceRoleDb?: ServiceRoleDb;
  /**
   * Test seam — fix the random sampler for deterministic judge selection.
   * Real callers should leave this undefined.
   */
  readonly rng?: () => number;
}
