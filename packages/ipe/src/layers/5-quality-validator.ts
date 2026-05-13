import { createOpenAI } from '@ai-sdk/openai';
import { Domain } from '@magic-prompt/shared';
import { generateText } from 'ai';

import { ipeLogger } from '../lib/logger';
import { withTimeout } from '../lib/timeout';
import {
  QualityMethod,
  type ClassifierResult,
  type HeuristicQualityResult,
  type LLMJudgeQualityResult,
  type QualityResult,
} from '../types';

const log = ipeLogger.child({ layer: 'validate' });

/**
 * Phrases that signal the assistant accidentally surfaced internals from the
 * magic prompt or our system message. Detected case-insensitively. Any hit
 * fails the leakage check loud — Phase 4's most important invariant is that
 * the IPE is INVISIBLE to the user.
 */
const LEAKAGE_PHRASES: readonly string[] = [
  '## context',
  '## task',
  '## instructions',
  '## data',
  'magic prompt',
  'invisible prompt engine',
  'as an ai',
  'as an ai assistant',
  'as a large language model',
  'i am an ai',
  "i'm an ai assistant", // legal + healthcare templates intentionally tell the LLM to open this way; whitelist below
  'system prompt',
  'pipeline_version',
  'primary_domain',
  'secondary_domain',
];

const LEAKAGE_WHITELIST_PER_DOMAIN: Readonly<Record<string, readonly string[]>> = {
  // Legal + healthcare templates explicitly instruct the model to OPEN with
  // an "I'm an AI assistant" disclaimer. That's intentional, not a leak.
  [Domain.LEGAL]: ["i'm an ai assistant", 'as an ai', 'i am an ai'],
  [Domain.HEALTHCARE]: ["i'm an ai assistant", 'as an ai', 'i am an ai'],
};

/**
 * Domain-specific keywords. We expect at least one to appear in a quality
 * response. Trivial keyword check; Phase 7 may upgrade to embeddings.
 */
const DOMAIN_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  [Domain.WEB_DEVELOPMENT]: [
    'code',
    'function',
    'component',
    'page',
    'html',
    'css',
    'route',
    'api',
  ],
  [Domain.REAL_ESTATE]: ['property', 'listing', 'home', 'buyer', 'seller', 'market', 'agent'],
  [Domain.CONTENT_WRITING]: ['paragraph', 'sentence', 'tone', 'audience', 'draft'],
  [Domain.MARKETING]: ['audience', 'campaign', 'channel', 'cta', 'conversion', 'funnel', 'icp'],
  [Domain.DATA_ANALYSIS]: ['data', 'column', 'query', 'analysis', 'sample', 'distribution', 'sql'],
  [Domain.EDUCATION]: ['learn', 'concept', 'example', 'explain', 'practice', 'understand'],
  [Domain.LEGAL]: ['clause', 'party', 'agreement', 'jurisdiction', 'liability', 'attorney', 'law'],
  [Domain.HEALTHCARE]: [
    'health',
    'symptom',
    'treatment',
    'doctor',
    'clinician',
    'evidence',
    'risk',
  ],
  [Domain.HR]: ['role', 'employee', 'manager', 'team', 'hire', 'review', 'policy', 'compensation'],
  [Domain.GENERAL]: [],
};

export interface QualityValidatorOptions {
  readonly assistantContent: string;
  readonly originalInput: string;
  readonly classifier: ClassifierResult;
  /** Whether this run is sampled for an LLM-as-judge follow-up (caller decides). */
  readonly runLLMJudge: boolean;
  readonly judgeModel?: string;
  readonly apiKey?: string;
  readonly judgeTimeoutMs?: number;
  readonly signal?: AbortSignal;
}

export async function runQualityValidator(opts: QualityValidatorOptions): Promise<QualityResult> {
  const heuristic = scoreHeuristics(opts.assistantContent, opts.classifier, opts.originalInput);

  if (heuristic.hasPromptLeakage) {
    // CRITICAL — log loudly. The pipeline already streamed to the user; we
    // can't redact, but we MUST record so the team can fix.
    log.error(
      {
        primaryDomain: opts.classifier.primary_domain,
        responseLength: opts.assistantContent.length,
      },
      'CRITICAL: prompt leakage detected in assistant response',
    );
  }

  if (!opts.runLLMJudge || !opts.apiKey || !opts.judgeModel) {
    return heuristic;
  }

  try {
    const judgeResult = await runLLMJudge(
      opts.assistantContent,
      opts.originalInput,
      opts.classifier,
      {
        apiKey: opts.apiKey,
        judgeModel: opts.judgeModel,
        judgeTimeoutMs: opts.judgeTimeoutMs ?? 15_000,
        ...(opts.signal && { signal: opts.signal }),
      },
    );
    return judgeResult;
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'LLM judge failed; falling back to heuristic score',
    );
    return heuristic;
  }
}

/**
 * Synchronous heuristic scoring. Five checks, weighted into a 0-100 score.
 */
export function scoreHeuristics(
  assistantContent: string,
  classifier: ClassifierResult,
  _originalInput: string,
): HeuristicQualityResult {
  const content = assistantContent ?? '';
  const lower = content.toLowerCase();

  // Check 1: length
  const lengthOk = content.length >= 200;

  // Check 2: structure — code block for web_dev / data_analysis; otherwise
  // any markdown structure (heading, bullet, paragraph break).
  const hasCodeBlock = /```/m.test(content);
  const hasMarkdownStructure = /^#|^- |\n\n/m.test(content);
  const structureOk =
    classifier.primary_domain === Domain.WEB_DEVELOPMENT ||
    classifier.primary_domain === Domain.DATA_ANALYSIS
      ? hasCodeBlock
      : hasMarkdownStructure || content.length >= 400;

  // Check 3: domain keywords
  const keywords = DOMAIN_KEYWORDS[classifier.primary_domain] ?? [];
  const keywordHit = keywords.length === 0 || keywords.some((kw) => lower.includes(kw));

  // Check 4: code syntax (basic) — for web_dev / data_analysis with code blocks
  const codeBlocks = [...content.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((m) => m[1] ?? '');
  const syntaxOk =
    codeBlocks.length === 0
      ? true
      : codeBlocks.every((cb) => {
          // Most basic structural check: balanced curly/square/parens AND
          // no obviously truncated lines (final line endwith , or {)
          const opens =
            (cb.match(/\{/g)?.length ?? 0) +
            (cb.match(/\[/g)?.length ?? 0) +
            (cb.match(/\(/g)?.length ?? 0);
          const closes =
            (cb.match(/\}/g)?.length ?? 0) +
            (cb.match(/\]/g)?.length ?? 0) +
            (cb.match(/\)/g)?.length ?? 0);
          return Math.abs(opens - closes) <= 2;
        });

  // Check 5: prompt leakage — most important
  const whitelist = LEAKAGE_WHITELIST_PER_DOMAIN[classifier.primary_domain] ?? [];
  const leakageHits = LEAKAGE_PHRASES.filter(
    (phrase) => lower.includes(phrase) && !whitelist.includes(phrase),
  );
  const hasPromptLeakage = leakageHits.length > 0;

  const checks: Record<string, boolean> = {
    length: lengthOk,
    structure: structureOk,
    domain_keywords: keywordHit,
    syntax: syntaxOk,
    no_prompt_leakage: !hasPromptLeakage,
  };

  // Length is a gating check: too-short responses can't meaningfully pass
  // the structure / keyword / syntax checks (they pass vacuously). We honour
  // the leakage check though — leakage in even one line is still a leak.
  // Scoring tiers:
  //   - length < 50:   max 0  (empty / one-line)
  //   - length < 200:  max 30 (only leakage check carries weight)
  //   - length >= 200: full 100 weighted across all 5 checks
  let score: number;
  if (content.length < 50) {
    score = 0;
  } else if (!lengthOk) {
    score = hasPromptLeakage ? 0 : 30;
  } else {
    score = Math.round(
      (lengthOk ? 17.5 : 0) +
        (structureOk ? 17.5 : 0) +
        (keywordHit ? 17.5 : 0) +
        (syntaxOk ? 17.5 : 0) +
        (!hasPromptLeakage ? 30 : 0),
    );
  }

  return {
    score,
    method: QualityMethod.HEURISTIC,
    checks,
    hasPromptLeakage,
  };
}

interface JudgeOptions {
  readonly apiKey: string;
  readonly judgeModel: string;
  readonly judgeTimeoutMs: number;
  readonly signal?: AbortSignal;
}

const JUDGE_SYSTEM = `You are a Quality Judge for AI responses. Score the response 0-100 based on:
- Completeness: did it fully address the user's request?
- Accuracy: are the claims correct and self-consistent?
- Format: is the structure appropriate for the domain?
- Helpfulness: would a real user be satisfied?

Output STRICT JSON: { "score": <number 0-100>, "reasoning": "<≤200 chars>" }`;

async function runLLMJudge(
  assistantContent: string,
  originalInput: string,
  classifier: ClassifierResult,
  opts: JudgeOptions,
): Promise<LLMJudgeQualityResult> {
  const sdk = createOpenAI({ apiKey: opts.apiKey });
  const truncated = assistantContent.slice(0, 2000);

  const result = await withTimeout('validate-judge', opts.judgeTimeoutMs, async () => {
    const completion = await generateText({
      model: sdk(opts.judgeModel),
      messages: [
        { role: 'system', content: JUDGE_SYSTEM },
        {
          role: 'user',
          content: `USER REQUEST: "${originalInput}"
PRIMARY DOMAIN: ${classifier.primary_domain}
RESPONSE: ${truncated}`,
        },
      ],
      temperature: 0,
      providerOptions: {
        openai: { responseFormat: { type: 'json_object' } },
      },
      ...(opts.signal && { abortSignal: opts.signal }),
    });

    const parsed = JSON.parse(
      completion.text
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, ''),
    );
    const score = Math.max(0, Math.min(100, Number(parsed.score)));
    const reasoning = String(parsed.reasoning ?? '').slice(0, 200);
    return { score, reasoning };
  });

  const heuristic = scoreHeuristics(assistantContent, classifier, originalInput);
  return {
    score: result.score,
    method: QualityMethod.LLM_JUDGE,
    reasoning: result.reasoning,
    checks: heuristic.checks,
    hasPromptLeakage: heuristic.hasPromptLeakage,
  };
}

export const __TEST = {
  LEAKAGE_PHRASES,
  LEAKAGE_WHITELIST_PER_DOMAIN,
  DOMAIN_KEYWORDS,
  scoreHeuristics,
};
