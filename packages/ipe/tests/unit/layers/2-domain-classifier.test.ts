/**
 * Layer 2 — Domain Classifier unit tests.
 *
 * Mocks the AI SDK so tests are deterministic. Coverage:
 *   - Per-domain "happy path" (one canonical example per domain × 10 domains)
 *   - Secondary domain composition (e.g. real-estate website = web_dev + real_estate)
 *   - Low-confidence path → caller-visible flag (no auto-fallback)
 *   - Complexity tier assignment (simple / moderate / expert)
 *   - Cross-domain ambiguous inputs
 *   - Failure modes: timeout, malformed JSON retry, schema-invalid output, total fallback
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __TEST,
  runDomainClassifier,
  type DomainClassifierOptions,
} from '../../../src/layers/2-domain-classifier';
import { DesiredOutput, type IntentParserResult } from '../../../src/types';

vi.mock('ai', async () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return { ...actual, generateText: vi.fn() };
});

const baseOpts: DomainClassifierOptions = {
  apiKey: 'sk-test-xxxxxxxxxxxxxxxx',
  model: 'gpt-4o-mini',
  timeoutMs: 5_000,
  retries: 1,
};

const baseIntent: IntentParserResult = {
  intent: 'do the thing',
  implied_context: '',
  desired_output: DesiredOutput.OTHER,
  missing_params: [],
  confidence: 0.9,
};

function jsonText(payload: Record<string, unknown>) {
  return {
    text: JSON.stringify(payload),
    usage: {
      inputTokens: 10,
      outputTokens: 30,
      totalTokens: 40,
      inputTokenDetails: {},
      outputTokenDetails: {},
    },
    finishReason: 'stop',
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  } as unknown as Awaited<ReturnType<typeof import('ai').generateText>>;
}

describe('parseAndValidate', () => {
  it('accepts a minimal valid classifier output', () => {
    const out = __TEST.parseAndValidate(
      JSON.stringify({
        primary_domain: 'web_development',
        secondary_domain: null,
        complexity: 'expert',
        confidence: 0.92,
        reasoning: 'user asked to build a Next.js app',
      }),
    );
    expect(out.primary_domain).toBe('web_development');
    expect(out.secondary_domain).toBeNull();
  });

  it('strips ```json fences', () => {
    const fenced =
      '```json\n' +
      JSON.stringify({
        primary_domain: 'general',
        secondary_domain: null,
        complexity: 'simple',
        confidence: 0.55,
        reasoning: 'no clear domain',
      }) +
      '\n```';
    expect(__TEST.parseAndValidate(fenced).primary_domain).toBe('general');
  });

  it('rejects an unknown domain string', () => {
    expect(() =>
      __TEST.parseAndValidate(
        JSON.stringify({
          primary_domain: 'rocket_science',
          secondary_domain: null,
          complexity: 'expert',
          confidence: 0.9,
          reasoning: 'x',
        }),
      ),
    ).toThrow();
  });

  it('rejects unknown complexity', () => {
    expect(() =>
      __TEST.parseAndValidate(
        JSON.stringify({
          primary_domain: 'general',
          secondary_domain: null,
          complexity: 'wizard',
          confidence: 0.9,
          reasoning: 'x',
        }),
      ),
    ).toThrow();
  });

  it('rejects non-JSON', () => {
    expect(() => __TEST.parseAndValidate('hi')).toThrow(/non-JSON/i);
  });
});

describe('runDomainClassifier — per-domain canonical examples', () => {
  beforeEach(() => vi.resetAllMocks());

  const perDomain: ReadonlyArray<{
    readonly domain: string;
    readonly intent: string;
    readonly complexity: 'simple' | 'moderate' | 'expert';
  }> = [
    { domain: 'web_development', intent: 'build a Next.js dashboard', complexity: 'expert' },
    { domain: 'real_estate', intent: 'comparable home valuation', complexity: 'moderate' },
    { domain: 'content_writing', intent: 'write a 1000-word blog post', complexity: 'moderate' },
    { domain: 'marketing', intent: 'craft a launch email sequence', complexity: 'expert' },
    { domain: 'data_analysis', intent: 'analyse churn from CSV', complexity: 'expert' },
    { domain: 'education', intent: 'teach linear algebra to a beginner', complexity: 'moderate' },
    { domain: 'legal', intent: 'draft an NDA for freelancer', complexity: 'expert' },
    { domain: 'healthcare', intent: 'lower cholesterol naturally', complexity: 'moderate' },
    { domain: 'hr', intent: 'write a senior engineer job description', complexity: 'moderate' },
    { domain: 'general', intent: 'just say hi', complexity: 'simple' },
  ];

  it.each(perDomain)('classifies %s correctly', async ({ domain, intent, complexity }) => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValueOnce(
      jsonText({
        primary_domain: domain,
        secondary_domain: null,
        complexity,
        confidence: 0.9,
        reasoning: `clear ${domain} request`,
      }),
    );

    const out = await runDomainClassifier({ ...baseIntent, intent }, intent, baseOpts);
    expect(out.fallbackUsed).toBe(false);
    expect(out.lowConfidence).toBe(false);
    expect(out.result.primary_domain).toBe(domain);
    expect(out.result.complexity).toBe(complexity);
  });
});

describe('runDomainClassifier — cross-domain composition', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns primary + secondary for "build real estate website"', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValueOnce(
      jsonText({
        primary_domain: 'web_development',
        secondary_domain: 'real_estate',
        complexity: 'expert',
        confidence: 0.93,
        reasoning: 'website build serving real-estate domain',
      }),
    );

    const out = await runDomainClassifier(baseIntent, 'real estate listing site', baseOpts);
    expect(out.result.primary_domain).toBe('web_development');
    expect(out.result.secondary_domain).toBe('real_estate');
  });

  it('returns null secondary for a single-domain intent', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValueOnce(
      jsonText({
        primary_domain: 'content_writing',
        secondary_domain: null,
        complexity: 'simple',
        confidence: 0.85,
        reasoning: 'pure blog writing',
      }),
    );

    const out = await runDomainClassifier(baseIntent, 'write a haiku about spring', baseOpts);
    expect(out.result.secondary_domain).toBeNull();
  });
});

describe('runDomainClassifier — low confidence handling', () => {
  beforeEach(() => vi.resetAllMocks());

  it('flags lowConfidence when classifier confidence < 0.6', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValueOnce(
      jsonText({
        primary_domain: 'general',
        secondary_domain: null,
        complexity: 'moderate',
        confidence: 0.4,
        reasoning: 'ambiguous',
      }),
    );

    const out = await runDomainClassifier(baseIntent, '???', baseOpts);
    expect(out.fallbackUsed).toBe(false); // not a fallback — LLM did respond
    expect(out.lowConfidence).toBe(true);
  });

  it('does NOT flag lowConfidence at the 0.6 boundary', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValueOnce(
      jsonText({
        primary_domain: 'general',
        secondary_domain: null,
        complexity: 'moderate',
        confidence: 0.6,
        reasoning: 'borderline',
      }),
    );

    const out = await runDomainClassifier(baseIntent, 'something', baseOpts);
    expect(out.lowConfidence).toBe(false);
  });

  it('CONFIDENCE_FLOOR exposed for callers is 0.6', () => {
    expect(__TEST.CONFIDENCE_FLOOR).toBe(0.6);
  });
});

describe('runDomainClassifier — failure modes', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.useRealTimers());

  it('retries once on malformed JSON', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText)
      .mockResolvedValueOnce({
        text: 'not json',
        usage: {
          inputTokens: 5,
          outputTokens: 5,
          totalTokens: 10,
          inputTokenDetails: {},
          outputTokenDetails: {},
        },
        finishReason: 'stop',
      } as unknown as Awaited<ReturnType<typeof generateText>>)
      .mockResolvedValueOnce(
        jsonText({
          primary_domain: 'education',
          secondary_domain: null,
          complexity: 'moderate',
          confidence: 0.85,
          reasoning: 'recovered',
        }),
      );

    const out = await runDomainClassifier(baseIntent, 'teach me', baseOpts);
    expect(out.fallbackUsed).toBe(false);
    expect(out.result.primary_domain).toBe('education');
    expect(vi.mocked(generateText)).toHaveBeenCalledTimes(2);
  });

  it('falls back when both attempts return invalid schema', async () => {
    const { generateText } = await import('ai');
    const bad = {
      text: JSON.stringify({
        primary_domain: 'martian_studies',
        secondary_domain: null,
        complexity: 'moderate',
        confidence: 0.8,
        reasoning: 'x',
      }),
      usage: {
        inputTokens: 5,
        outputTokens: 5,
        totalTokens: 10,
        inputTokenDetails: {},
        outputTokenDetails: {},
      },
      finishReason: 'stop',
    } as unknown as Awaited<ReturnType<typeof generateText>>;
    vi.mocked(generateText).mockResolvedValueOnce(bad).mockResolvedValueOnce(bad);

    const out = await runDomainClassifier(baseIntent, 'whatever', baseOpts);
    expect(out.fallbackUsed).toBe(true);
    expect(out.lowConfidence).toBe(true);
    expect(out.result.primary_domain).toBe('general');
    expect(out.result.complexity).toBe('moderate');
  });

  it('falls back immediately on timeout', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockImplementationOnce(
      () => new Promise(() => {}) as unknown as ReturnType<typeof generateText>,
    );

    const out = await runDomainClassifier(baseIntent, 'slow', { ...baseOpts, timeoutMs: 30 });
    expect(out.fallbackUsed).toBe(true);
    expect(vi.mocked(generateText)).toHaveBeenCalledTimes(1);
  });

  it('falls back when LLM throws repeatedly', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText)
      .mockRejectedValueOnce(new Error('flake'))
      .mockRejectedValueOnce(new Error('flake'));

    const out = await runDomainClassifier(baseIntent, 'x', baseOpts);
    expect(out.fallbackUsed).toBe(true);
    expect(out.lowConfidence).toBe(true);
  });
});
