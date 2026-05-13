/**
 * Layer 1 — Intent Parser unit tests.
 *
 * Mocks the AI SDK (`generateText`) so tests are deterministic + offline.
 * The "lazy input" cases are the heart of the IPE moat — these are the
 * shapes a real user types that we expect Layer 1 to turn into structured
 * intent. Any regression here cascades through the whole pipeline.
 *
 * Coverage targets:
 *   - 10+ lazy-input shapes (real estate, code, content, etc)
 *   - 5+ edge cases (empty, long, code snippet, multilingual, emoji-only)
 *   - Failure modes: malformed JSON, schema reject, timeout, retry, abort
 *   - Fallback returns the safe-default shape with fallbackUsed=true
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __TEST,
  runIntentParser,
  type IntentParserOptions,
} from '../../../src/layers/1-intent-parser';

vi.mock('ai', async () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

const baseOpts: IntentParserOptions = {
  apiKey: 'sk-test-xxxxxxxxxxxxxxxx',
  model: 'gpt-4o-mini',
  timeoutMs: 5_000,
  retries: 1,
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

describe('parseAndValidate (pure)', () => {
  it('accepts a clean JSON object', () => {
    const result = __TEST.parseAndValidate(
      JSON.stringify({
        intent: 'build a real estate listing site',
        implied_context: 'residential property platform',
        desired_output: 'production_code',
        missing_params: ['design style', 'target market'],
        confidence: 0.92,
      }),
    );
    expect(result.intent).toBe('build a real estate listing site');
    expect(result.desired_output).toBe('production_code');
    expect(result.missing_params).toHaveLength(2);
    expect(result.confidence).toBeCloseTo(0.92);
  });

  it('strips ```json fences before parsing', () => {
    const fenced =
      '```json\n' +
      JSON.stringify({
        intent: 'write a blog post',
        implied_context: '',
        desired_output: 'content',
        missing_params: [],
        confidence: 0.7,
      }) +
      '\n```';
    const result = __TEST.parseAndValidate(fenced);
    expect(result.intent).toBe('write a blog post');
  });

  it('rejects malformed JSON', () => {
    expect(() => __TEST.parseAndValidate('not json {{}')).toThrow(/non-JSON/i);
  });

  it('rejects schema-invalid output (wrong desired_output enum)', () => {
    expect(() =>
      __TEST.parseAndValidate(
        JSON.stringify({
          intent: 'x',
          implied_context: '',
          desired_output: 'unknown_value',
          missing_params: [],
          confidence: 0.5,
        }),
      ),
    ).toThrow();
  });

  it('rejects confidence outside 0-1', () => {
    expect(() =>
      __TEST.parseAndValidate(
        JSON.stringify({
          intent: 'x',
          implied_context: '',
          desired_output: 'other',
          missing_params: [],
          confidence: 1.5,
        }),
      ),
    ).toThrow();
  });
});

describe('runIntentParser — happy paths (real lazy inputs)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const lazyInputs: ReadonlyArray<{
    readonly name: string;
    readonly input: string;
    readonly expectedIntent: string;
    readonly expectedDesired: string;
  }> = [
    {
      name: 'real estate website',
      input: 'create real estate website',
      expectedIntent: 'build real estate listing site',
      expectedDesired: 'production_code',
    },
    {
      name: 'pitch deck',
      input: 'make me a pitch deck for ai saas',
      expectedIntent: 'create AI SaaS pitch deck',
      expectedDesired: 'document',
    },
    {
      name: 'blog post',
      input: 'write blog about react server components',
      expectedIntent: 'write blog post about RSC',
      expectedDesired: 'content',
    },
    {
      name: 'sql query',
      input: 'query to find top customers',
      expectedIntent: 'write SQL query for top customers',
      expectedDesired: 'production_code',
    },
    {
      name: 'marketing email',
      input: 'cold email for selling crm',
      expectedIntent: 'write cold outreach email for CRM',
      expectedDesired: 'content',
    },
    {
      name: 'lesson plan',
      input: 'teach me linear algebra basics',
      expectedIntent: 'explain linear algebra fundamentals',
      expectedDesired: 'explanation',
    },
    {
      name: 'legal contract',
      input: 'nda for freelancer',
      expectedIntent: 'draft NDA for freelance contractor',
      expectedDesired: 'document',
    },
    {
      name: 'health advice',
      input: 'how to lower cholesterol',
      expectedIntent: 'recommend ways to lower cholesterol',
      expectedDesired: 'recommendation',
    },
    {
      name: 'hr job desc',
      input: 'job description senior react engineer',
      expectedIntent: 'write senior React engineer JD',
      expectedDesired: 'document',
    },
    {
      name: 'data analysis',
      input: 'analyze churn from this csv',
      expectedIntent: 'analyse churn data from CSV',
      expectedDesired: 'analysis',
    },
  ];

  it.each(lazyInputs)(
    'parses "$name" lazy input',
    async ({ input, expectedIntent, expectedDesired }) => {
      const { generateText } = await import('ai');
      vi.mocked(generateText).mockResolvedValueOnce(
        jsonText({
          intent: expectedIntent,
          implied_context: 'sample context',
          desired_output: expectedDesired,
          missing_params: ['target audience'],
          confidence: 0.9,
        }),
      );

      const out = await runIntentParser(input, baseOpts);
      expect(out.fallbackUsed).toBe(false);
      expect(out.result.intent).toBe(expectedIntent);
      expect(out.result.desired_output).toBe(expectedDesired);
      expect(out.latencyMs).toBeGreaterThanOrEqual(0);
    },
  );
});

describe('runIntentParser — edge cases', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('handles empty input (LLM returns low-confidence default)', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValueOnce(
      jsonText({
        intent: 'respond to user',
        implied_context: '',
        desired_output: 'other',
        missing_params: ['everything'],
        confidence: 0.1,
      }),
    );

    const out = await runIntentParser('', baseOpts);
    expect(out.fallbackUsed).toBe(false);
    expect(out.result.confidence).toBeLessThan(0.3);
  });

  it('handles very long input (no truncation server-side)', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValueOnce(
      jsonText({
        intent: 'summarise long requirements',
        implied_context: 'enterprise software spec',
        desired_output: 'document',
        missing_params: [],
        confidence: 0.85,
      }),
    );

    const longInput = 'I need to build a system that '.repeat(200);
    const out = await runIntentParser(longInput, baseOpts);
    expect(out.fallbackUsed).toBe(false);
    expect(out.result.intent).toContain('summarise');
  });

  it('handles code snippet input', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValueOnce(
      jsonText({
        intent: 'debug TypeScript error',
        implied_context: 'fix compile-time type error',
        desired_output: 'production_code',
        missing_params: ['target framework'],
        confidence: 0.88,
      }),
    );

    const codeInput = "type X = { y: string }; const x: X = { y: 1 };  // why doesn't this work";
    const out = await runIntentParser(codeInput, baseOpts);
    expect(out.fallbackUsed).toBe(false);
    expect(out.result.desired_output).toBe('production_code');
  });

  it('handles multilingual input (Hindi)', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValueOnce(
      jsonText({
        intent: 'write a poem in Hindi',
        implied_context: 'creative writing in devanagari',
        desired_output: 'content',
        missing_params: ['theme', 'length'],
        confidence: 0.91,
      }),
    );

    const out = await runIntentParser('मेरे लिए एक कविता लिखो', baseOpts);
    expect(out.fallbackUsed).toBe(false);
    expect(out.result.intent).toContain('poem');
  });

  it('handles emoji-only input gracefully', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValueOnce(
      jsonText({
        intent: 'respond to ambiguous input',
        implied_context: '',
        desired_output: 'other',
        missing_params: ['any concrete request'],
        confidence: 0.05,
      }),
    );

    const out = await runIntentParser('🚀🎉', baseOpts);
    expect(out.fallbackUsed).toBe(false);
    expect(out.result.confidence).toBeLessThan(0.2);
  });
});

describe('runIntentParser — failure modes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries once on malformed JSON, then succeeds', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText)
      .mockResolvedValueOnce({
        text: 'this is not json',
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
          intent: 'recovered intent',
          implied_context: '',
          desired_output: 'other',
          missing_params: [],
          confidence: 0.8,
        }),
      );

    const out = await runIntentParser('test', baseOpts);
    expect(out.fallbackUsed).toBe(false);
    expect(out.result.intent).toBe('recovered intent');
    expect(vi.mocked(generateText)).toHaveBeenCalledTimes(2);
  });

  it('falls back when both attempts return malformed JSON', async () => {
    const { generateText } = await import('ai');
    const badResp = {
      text: 'still not json',
      usage: {
        inputTokens: 5,
        outputTokens: 5,
        totalTokens: 10,
        inputTokenDetails: {},
        outputTokenDetails: {},
      },
      finishReason: 'stop',
    } as unknown as Awaited<ReturnType<typeof generateText>>;
    vi.mocked(generateText).mockResolvedValueOnce(badResp).mockResolvedValueOnce(badResp);

    const out = await runIntentParser('test query', baseOpts);
    expect(out.fallbackUsed).toBe(true);
    expect(out.result.confidence).toBe(0.0);
    expect(out.result.intent).toBe('test query');
  });

  it('falls back immediately on timeout (no retry)', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockImplementationOnce(
      () =>
        new Promise((_resolve) => {
          // Hangs forever — p-timeout aborts at 50ms.
        }) as unknown as ReturnType<typeof generateText>,
    );

    const out = await runIntentParser('slow query', { ...baseOpts, timeoutMs: 50 });
    expect(out.fallbackUsed).toBe(true);
    expect(out.result.intent).toBe('slow query');
    // Only one attempt — no retry budget burned on timeout.
    expect(vi.mocked(generateText)).toHaveBeenCalledTimes(1);
  });

  it('falls back when LLM throws on every attempt', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText)
      .mockRejectedValueOnce(new Error('network blip'))
      .mockRejectedValueOnce(new Error('network blip'));

    const out = await runIntentParser('hello', baseOpts);
    expect(out.fallbackUsed).toBe(true);
    expect(out.result.intent).toBe('hello');
  });

  it('returns latencyMs >= 0 even on fallback', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText)
      .mockRejectedValueOnce(new Error('x'))
      .mockRejectedValueOnce(new Error('x'));
    const out = await runIntentParser('whatever', baseOpts);
    expect(out.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

describe('DEFAULT_FALLBACK shape', () => {
  it('truncates very long input intent to 120 chars', () => {
    const long = 'a'.repeat(500);
    const result = __TEST.DEFAULT_FALLBACK(long);
    expect(result.intent.length).toBe(120);
    expect(result.confidence).toBe(0.0);
    expect(result.desired_output).toBe('other');
  });

  it('returns "respond to user" when input is empty', () => {
    const result = __TEST.DEFAULT_FALLBACK('');
    expect(result.intent).toBe('respond to user');
  });

  it('trims input whitespace', () => {
    const result = __TEST.DEFAULT_FALLBACK('   hello   ');
    expect(result.intent).toBe('hello');
  });
});
