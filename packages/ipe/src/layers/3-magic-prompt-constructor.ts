import { Complexity, Domain, type Complexity as ComplexityType } from '@magic-prompt/shared';

import { ipeLogger } from '../lib/logger';
import { getTemplate } from '../templates';

import type { ClassifierResult, IntentParserResult, MagicPrompt } from '../types';
import type { LLMMessage } from '@magic-prompt/llm';

const log = ipeLogger.child({ layer: 'construct' });

export interface ConstructorOutput {
  readonly prompt: MagicPrompt;
  readonly messages: readonly LLMMessage[];
  readonly latencyMs: number;
  readonly templateUsed: string;
  readonly complexityCoerced: boolean;
}

/**
 * Layer 3 — assemble the structured magic prompt from the parsed intent +
 * classifier output. Pure code: no LLM call.
 *
 * `complexityCoerced` is set when the classifier was low-confidence and we
 * defaulted to `moderate` for safety. Tracked separately so the caller can
 * log it without overloading `fallbackUsed`.
 */
export function runMagicPromptConstructor(
  intent: IntentParserResult,
  classifier: ClassifierResult,
  userMessage: string,
  options: { readonly lowConfidence: boolean },
): ConstructorOutput {
  const start = Date.now();

  // Coerce primary_domain + complexity to safe defaults when the classifier
  // signalled low confidence. The classifier already returned valid enums
  // (Zod-validated), so this is just a quality-floor not a type guard.
  const primaryDomain: Domain = options.lowConfidence ? Domain.GENERAL : classifier.primary_domain;
  const complexityCoerced = options.lowConfidence && classifier.complexity !== Complexity.MODERATE;
  const complexity: ComplexityType = options.lowConfidence
    ? Complexity.MODERATE
    : classifier.complexity;

  const template = getTemplate(primaryDomain);
  const prompt = template.buildPrompt({
    userMessage,
    intent: intent.intent,
    impliedContext: intent.implied_context,
    desiredOutput: intent.desired_output,
    missingParams: intent.missing_params,
    primaryDomain,
    secondaryDomain: classifier.secondary_domain,
    complexity,
  });

  const messages: readonly LLMMessage[] = [
    { role: 'system', content: prompt.systemMessage },
    { role: 'user', content: prompt.userMessage },
  ];

  const out: ConstructorOutput = {
    prompt,
    messages,
    latencyMs: Date.now() - start,
    templateUsed: `${primaryDomain}@${template.version}`,
    complexityCoerced,
  };

  log.debug(
    {
      domain: primaryDomain,
      complexity,
      templateVersion: template.version,
      promptLength: prompt.systemMessage.length + prompt.userMessage.length,
      latencyMs: out.latencyMs,
    },
    'magic prompt constructed',
  );

  return out;
}
