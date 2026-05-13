import { ALL_COMPLEXITIES, ALL_DOMAINS, Complexity, Domain } from '@magic-prompt/shared';
import { describe, expect, it } from 'vitest';

import { runMagicPromptConstructor } from '../../../src/layers/3-magic-prompt-constructor';
import { getTemplate, TEMPLATE_REGISTRY } from '../../../src/templates';
import { DesiredOutput, type ClassifierResult, type IntentParserResult } from '../../../src/types';

const baseIntent: IntentParserResult = {
  intent: 'build something useful',
  implied_context: '',
  desired_output: DesiredOutput.OTHER,
  missing_params: [],
  confidence: 0.9,
};

const baseClassifier: ClassifierResult = {
  primary_domain: Domain.GENERAL,
  secondary_domain: null,
  complexity: Complexity.MODERATE,
  confidence: 0.9,
  reasoning: 'test',
};

const baseUserMessage = 'help me with a thing';

describe('TEMPLATE_REGISTRY — coverage', () => {
  it('has a template registered for every Domain enum value', () => {
    for (const domain of ALL_DOMAINS) {
      expect(TEMPLATE_REGISTRY[domain]).toBeDefined();
      expect(TEMPLATE_REGISTRY[domain].domain).toBe(domain);
    }
  });

  it('getTemplate returns the right template for each domain', () => {
    for (const domain of ALL_DOMAINS) {
      expect(getTemplate(domain).domain).toBe(domain);
    }
  });

  it('every template carries a version string', () => {
    for (const domain of ALL_DOMAINS) {
      const t = TEMPLATE_REGISTRY[domain];
      expect(t.version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });
});

describe('every template builds a valid 4-part magic prompt', () => {
  for (const domain of ALL_DOMAINS) {
    for (const complexity of ALL_COMPLEXITIES) {
      it(`${domain} × ${complexity}`, () => {
        const out = runMagicPromptConstructor(
          { ...baseIntent, intent: `do ${domain} thing` },
          { ...baseClassifier, primary_domain: domain, complexity },
          baseUserMessage,
          { lowConfidence: false },
        );

        // System message non-empty, mentions an expert-ish persona
        expect(out.prompt.systemMessage.length).toBeGreaterThan(80);

        // User message has all 4 sections in order
        expect(out.prompt.userMessage).toContain('## Context');
        expect(out.prompt.userMessage).toContain('## Task');
        expect(out.prompt.userMessage).toContain('## Instructions');
        expect(out.prompt.userMessage).toContain('## Data');

        // Quality bar mention scales with complexity
        const text = out.prompt.userMessage.toLowerCase();
        if (complexity === Complexity.EXPERT) {
          expect(text).toMatch(/production|ship|polish|complete|thorough/);
        }

        // Messages array shape
        expect(out.messages).toHaveLength(2);
        expect(out.messages[0]!.role).toBe('system');
        expect(out.messages[1]!.role).toBe('user');

        // Template used = "<domain>@<version>"
        expect(out.templateUsed.startsWith(`${domain}@`)).toBe(true);
      });
    }
  }
});

describe('low-confidence coercion', () => {
  it('coerces low-confidence non-general into GENERAL/MODERATE', () => {
    const out = runMagicPromptConstructor(
      baseIntent,
      {
        ...baseClassifier,
        primary_domain: Domain.LEGAL,
        complexity: Complexity.EXPERT,
        confidence: 0.4,
      },
      baseUserMessage,
      { lowConfidence: true },
    );

    expect(out.templateUsed.startsWith(`${Domain.GENERAL}@`)).toBe(true);
    expect(out.complexityCoerced).toBe(true);
  });

  it('does NOT coerce when low confidence happens to already be GENERAL/MODERATE', () => {
    const out = runMagicPromptConstructor(
      baseIntent,
      {
        ...baseClassifier,
        primary_domain: Domain.GENERAL,
        complexity: Complexity.MODERATE,
        confidence: 0.5,
      },
      baseUserMessage,
      { lowConfidence: true },
    );

    // Domain coercion happens but it's a no-op so complexityCoerced stays false
    expect(out.complexityCoerced).toBe(false);
  });

  it('high confidence preserves the classifier output (no coercion)', () => {
    const out = runMagicPromptConstructor(
      baseIntent,
      {
        ...baseClassifier,
        primary_domain: Domain.LEGAL,
        complexity: Complexity.EXPERT,
        confidence: 0.95,
      },
      baseUserMessage,
      { lowConfidence: false },
    );

    expect(out.templateUsed.startsWith(`${Domain.LEGAL}@`)).toBe(true);
    expect(out.complexityCoerced).toBe(false);
  });
});

describe('domain-specific signals appear in the magic prompt', () => {
  it('legal prompt opens with the not-a-lawyer disclaimer guidance', () => {
    const out = runMagicPromptConstructor(
      { ...baseIntent, intent: 'draft an NDA' },
      { ...baseClassifier, primary_domain: Domain.LEGAL, complexity: Complexity.EXPERT },
      'draft me an NDA',
      { lowConfidence: false },
    );
    // The system message tells the assistant to ALWAYS open with the disclaimer
    expect(out.prompt.userMessage + out.prompt.systemMessage).toMatch(
      /not.+lawyer|licensed attorney/i,
    );
  });

  it('healthcare prompt requires the not-personal-medical-advice disclaimer', () => {
    const out = runMagicPromptConstructor(
      { ...baseIntent, intent: 'lower cholesterol' },
      { ...baseClassifier, primary_domain: Domain.HEALTHCARE, complexity: Complexity.MODERATE },
      'how do I lower cholesterol',
      { lowConfidence: false },
    );
    expect(out.prompt.userMessage + out.prompt.systemMessage).toMatch(
      /not.+personal medical advice|licensed clinician/i,
    );
  });

  it('web-dev prompt names a default tech stack', () => {
    const out = runMagicPromptConstructor(
      { ...baseIntent, intent: 'build a dashboard' },
      {
        ...baseClassifier,
        primary_domain: Domain.WEB_DEVELOPMENT,
        complexity: Complexity.EXPERT,
      },
      'dashboard for sales metrics',
      { lowConfidence: false },
    );
    expect(out.prompt.userMessage + out.prompt.systemMessage).toMatch(
      /Next\.js|React Native|SvelteKit|FastAPI/,
    );
  });

  it('cross-domain (web-dev × real-estate) renders both in the prompt', () => {
    const out = runMagicPromptConstructor(
      { ...baseIntent, intent: 'build real estate site' },
      {
        ...baseClassifier,
        primary_domain: Domain.WEB_DEVELOPMENT,
        secondary_domain: Domain.REAL_ESTATE,
        complexity: Complexity.EXPERT,
      },
      'real estate listing website',
      { lowConfidence: false },
    );
    expect(out.prompt.userMessage).toContain('real_estate');
  });
});

describe('missing_params handling', () => {
  it('flags missing params in the Context section', () => {
    const out = runMagicPromptConstructor(
      {
        ...baseIntent,
        intent: 'write a blog post',
        missing_params: ['target audience', 'desired length', 'tone'],
      },
      { ...baseClassifier, primary_domain: Domain.CONTENT_WRITING },
      'write a blog post',
      { lowConfidence: false },
    );
    expect(out.prompt.userMessage).toContain('target audience');
    expect(out.prompt.userMessage).toContain('desired length');
    expect(out.prompt.userMessage.toLowerCase()).toContain('sensible production defaults');
  });

  it('omits the missing-params note when array is empty', () => {
    const out = runMagicPromptConstructor(
      { ...baseIntent, missing_params: [] },
      baseClassifier,
      baseUserMessage,
      { lowConfidence: false },
    );
    expect(out.prompt.userMessage.toLowerCase()).not.toContain('the user did not specify');
  });
});

describe('quality bar', () => {
  it('expert bar appears in Data section for expert tier', () => {
    const out = runMagicPromptConstructor(
      baseIntent,
      { ...baseClassifier, complexity: Complexity.EXPERT },
      baseUserMessage,
      { lowConfidence: false },
    );
    expect(out.prompt.userMessage.toLowerCase()).toContain('ship-it quality');
  });

  it('simple bar appears for simple tier', () => {
    const out = runMagicPromptConstructor(
      baseIntent,
      { ...baseClassifier, complexity: Complexity.SIMPLE },
      baseUserMessage,
      { lowConfidence: false },
    );
    expect(out.prompt.userMessage.toLowerCase()).toContain('demo-able');
  });
});
