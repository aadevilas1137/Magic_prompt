import { Complexity, Domain } from '@magic-prompt/shared';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
  __TEST,
  runQualityValidator,
  scoreHeuristics,
} from '../../../src/layers/5-quality-validator';
import { QualityMethod, type ClassifierResult } from '../../../src/types';

vi.mock('ai', async () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return { ...actual, generateText: vi.fn() };
});

const classifier = (domain: Domain): ClassifierResult => ({
  primary_domain: domain,
  secondary_domain: null,
  complexity: Complexity.MODERATE,
  confidence: 0.9,
  reasoning: 'test',
});

const LONG_GOOD_RESPONSE = `# Setting up a Next.js dashboard

Here's the file structure:
\`\`\`tsx
// app/dashboard/page.tsx
export default function Dashboard() {
  return (
    <main className="p-6">
      <h1>Sales metrics</h1>
      <Chart data={[]} />
    </main>
  );
}
\`\`\`

Key points:
- Uses semantic HTML for the dashboard route.
- Loading + error states would go in the parallel boundary files.
- The component is a server component by default.`;

describe('scoreHeuristics — length check', () => {
  it('passes length when content >= 200 chars', () => {
    const out = scoreHeuristics('x'.repeat(220), classifier(Domain.GENERAL), 'q');
    expect(out.checks.length).toBe(true);
  });

  it('fails length for short content', () => {
    const out = scoreHeuristics('too short', classifier(Domain.GENERAL), 'q');
    expect(out.checks.length).toBe(false);
  });
});

describe('scoreHeuristics — structure check', () => {
  it('requires code blocks for web_development', () => {
    const noCode = scoreHeuristics(
      'Plain prose answer.'.repeat(20),
      classifier(Domain.WEB_DEVELOPMENT),
      'build',
    );
    expect(noCode.checks.structure).toBe(false);
  });

  it('accepts code blocks for web_development', () => {
    const out = scoreHeuristics(LONG_GOOD_RESPONSE, classifier(Domain.WEB_DEVELOPMENT), 'build');
    expect(out.checks.structure).toBe(true);
  });

  it('accepts plain prose structure for content_writing', () => {
    const out = scoreHeuristics(
      `# Heading\n\n- Bullet 1\n- Bullet 2`,
      classifier(Domain.CONTENT_WRITING),
      'write',
    );
    expect(out.checks.structure).toBe(true);
  });
});

describe('scoreHeuristics — domain keywords', () => {
  it('hits a web_development keyword', () => {
    const out = scoreHeuristics(LONG_GOOD_RESPONSE, classifier(Domain.WEB_DEVELOPMENT), 'q');
    expect(out.checks.domain_keywords).toBe(true);
  });

  it('misses keywords for irrelevant content', () => {
    const out = scoreHeuristics(
      'A poem about clouds and sunshine.'.repeat(20),
      classifier(Domain.WEB_DEVELOPMENT),
      'q',
    );
    expect(out.checks.domain_keywords).toBe(false);
  });

  it('general domain has no keyword requirement (always passes)', () => {
    const out = scoreHeuristics(
      'Whatever response shape works here.'.repeat(20),
      classifier(Domain.GENERAL),
      'q',
    );
    expect(out.checks.domain_keywords).toBe(true);
  });
});

describe('scoreHeuristics — prompt leakage detection (CRITICAL)', () => {
  it('flags ## Context leakage', () => {
    const leakageContent = `Sure, here's the answer.

## Context
This is industry-grade...
## Task
Build this thing.`;
    const out = scoreHeuristics(leakageContent, classifier(Domain.GENERAL), 'q');
    expect(out.hasPromptLeakage).toBe(true);
    expect(out.checks.no_prompt_leakage).toBe(false);
  });

  it('flags "magic prompt" mention', () => {
    const leakage = `I generated this magic prompt for you: ...`.repeat(10);
    const out = scoreHeuristics(leakage, classifier(Domain.GENERAL), 'q');
    expect(out.hasPromptLeakage).toBe(true);
  });

  it('flags "as an AI" filler', () => {
    const out = scoreHeuristics(
      `As an AI, I think this is a great idea.`.repeat(20),
      classifier(Domain.GENERAL),
      'q',
    );
    expect(out.hasPromptLeakage).toBe(true);
  });

  it('whitelists "I\'m an AI assistant" for LEGAL domain', () => {
    const legalDisclaimer =
      `I'm an AI assistant, not a lawyer. This is informational, not legal advice. Consult a licensed attorney in your jurisdiction.`.repeat(
        2,
      );
    const out = scoreHeuristics(legalDisclaimer, classifier(Domain.LEGAL), 'draft NDA');
    expect(out.hasPromptLeakage).toBe(false);
  });

  it('whitelists "I\'m an AI assistant" for HEALTHCARE domain', () => {
    const healthDisclaimer =
      `I'm an AI assistant providing general health information, not personal medical advice. Consult a licensed clinician.`.repeat(
        2,
      );
    const out = scoreHeuristics(healthDisclaimer, classifier(Domain.HEALTHCARE), 'q');
    expect(out.hasPromptLeakage).toBe(false);
  });

  it('clean response has no leakage', () => {
    const out = scoreHeuristics(LONG_GOOD_RESPONSE, classifier(Domain.WEB_DEVELOPMENT), 'q');
    expect(out.hasPromptLeakage).toBe(false);
  });
});

describe('scoreHeuristics — overall score weighting', () => {
  it('clean perfect web-dev response scores 100', () => {
    const out = scoreHeuristics(LONG_GOOD_RESPONSE, classifier(Domain.WEB_DEVELOPMENT), 'q');
    expect(out.score).toBe(100);
  });

  it('leakage alone caps score at 70 (loses the 30% leakage weight)', () => {
    const leaky = LONG_GOOD_RESPONSE + '\n\n## Context\n(internal)';
    const out = scoreHeuristics(leaky, classifier(Domain.WEB_DEVELOPMENT), 'q');
    expect(out.score).toBeLessThanOrEqual(70);
  });

  it('totally empty content scores at most 30 (leakage check passes vacuously)', () => {
    const out = scoreHeuristics('', classifier(Domain.GENERAL), 'q');
    expect(out.score).toBeLessThanOrEqual(30);
  });
});

describe('runQualityValidator — orchestration', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns heuristic when LLM judge is disabled', async () => {
    const out = await runQualityValidator({
      assistantContent: LONG_GOOD_RESPONSE,
      originalInput: 'build dashboard',
      classifier: classifier(Domain.WEB_DEVELOPMENT),
      runLLMJudge: false,
    });
    expect(out.method).toBe(QualityMethod.HEURISTIC);
    expect(out.score).toBe(100);
  });

  it('runs LLM judge when enabled + caller supplies key/model', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValueOnce({
      text: JSON.stringify({
        score: 87,
        reasoning: 'solid coverage but slightly terse on edge cases',
      }),
      usage: {
        inputTokens: 50,
        outputTokens: 20,
        totalTokens: 70,
        inputTokenDetails: {},
        outputTokenDetails: {},
      },
      finishReason: 'stop',
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    const out = await runQualityValidator({
      assistantContent: LONG_GOOD_RESPONSE,
      originalInput: 'build dashboard',
      classifier: classifier(Domain.WEB_DEVELOPMENT),
      runLLMJudge: true,
      judgeModel: 'gpt-4o-mini',
      apiKey: 'sk-test-xxxxxxxxxxxxxxxx',
    });
    expect(out.method).toBe(QualityMethod.LLM_JUDGE);
    expect(out.score).toBe(87);
    if (out.method === QualityMethod.LLM_JUDGE) {
      expect(out.reasoning).toContain('solid');
    }
  });

  it('falls back to heuristic when LLM judge throws', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockRejectedValueOnce(new Error('judge blip'));

    const out = await runQualityValidator({
      assistantContent: LONG_GOOD_RESPONSE,
      originalInput: 'build dashboard',
      classifier: classifier(Domain.WEB_DEVELOPMENT),
      runLLMJudge: true,
      judgeModel: 'gpt-4o-mini',
      apiKey: 'sk-test-xxxxxxxxxxxxxxxx',
    });
    expect(out.method).toBe(QualityMethod.HEURISTIC);
    expect(out.score).toBe(100);
  });
});

describe('LEAKAGE_PHRASES + whitelist invariants', () => {
  it('every whitelist phrase exists in LEAKAGE_PHRASES', () => {
    for (const phrases of Object.values(__TEST.LEAKAGE_WHITELIST_PER_DOMAIN)) {
      for (const phrase of phrases) {
        expect(__TEST.LEAKAGE_PHRASES).toContain(phrase);
      }
    }
  });

  it('DOMAIN_KEYWORDS has an entry for every Domain', () => {
    for (const d of Object.values(Domain)) {
      expect(__TEST.DOMAIN_KEYWORDS[d]).toBeDefined();
    }
  });
});
