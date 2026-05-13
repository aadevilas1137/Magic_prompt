import { createOpenAI } from '@ai-sdk/openai';
import { ALL_DOMAINS, Complexity, Domain } from '@magic-prompt/shared';
import { generateText } from 'ai';

import { ipeLogger } from '../lib/logger';
import { withTimeout, IPELayerTimeoutError } from '../lib/timeout';
import { ClassifierResultSchema, type ClassifierResult, type IntentParserResult } from '../types';

const log = ipeLogger.child({ layer: 'classify' });

const CONFIDENCE_FLOOR = 0.6;

const DOMAIN_LIST = ALL_DOMAINS.map((d) => `- ${d}`).join('\n');

const SYSTEM_PROMPT = `You are a Domain Classifier for an AI prompt engineering pipeline. Given a user's intent + raw message, pick the correct domain + complexity.

Available domains (you MUST pick from these EXACTLY — no other strings allowed):
${DOMAIN_LIST}

Complexity levels:
- simple — basic info, single concept, short answer expected
- moderate — multi-step, some expertise required
- expert — production-quality, deep domain knowledge required

Output STRICT JSON matching this schema (no markdown, no commentary):
{
  "primary_domain": "<one of the domains above>",
  "secondary_domain": "<one of the domains above, or null if none>",
  "complexity": "simple | moderate | expert",
  "confidence": "number 0.0-1.0 — your certainty about primary_domain",
  "reasoning": "string ≤ 200 chars — one sentence explaining the choice"
}

Rules:
- "primary_domain" must be one of the listed enum values, not a variation.
- Use "general" only when no specialised domain clearly applies.
- "secondary_domain" should be set only when the intent genuinely spans two domains (e.g. a real-estate website is web_development + real_estate). Otherwise null.
- If unsure, set confidence < 0.6 — the pipeline will fall back to general/moderate.
- "complexity" reflects what a quality response would require, not what the user said.`;

export interface DomainClassifierOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly timeoutMs: number;
  readonly retries?: number;
  readonly signal?: AbortSignal;
}

export interface DomainClassifierOutput {
  readonly result: ClassifierResult;
  readonly latencyMs: number;
  readonly fallbackUsed: boolean;
  readonly lowConfidence: boolean;
}

const LOW_CONFIDENCE_FALLBACK: ClassifierResult = {
  primary_domain: Domain.GENERAL,
  secondary_domain: null,
  complexity: Complexity.MODERATE,
  confidence: 0.0,
  reasoning: 'classifier unavailable — defaulted to general/moderate',
};

/**
 * Layer 2 — assign domain + complexity to the parsed intent.
 *
 * If confidence < 0.6 we DON'T treat that as a fallback (the LLM gave us a
 * valid response), but the calling pipeline can decide to coerce to
 * `general/moderate` via the `lowConfidence` flag. Hard fallback only fires
 * on timeout, repeated parse failure, or LLM error.
 */
export async function runDomainClassifier(
  intent: IntentParserResult,
  userMessage: string,
  opts: DomainClassifierOptions,
): Promise<DomainClassifierOutput> {
  const start = Date.now();
  const maxRetries = opts.retries ?? 1;
  const sdk = createOpenAI({ apiKey: opts.apiKey });

  const userBlock = `USER INTENT: ${intent.intent}
IMPLIED CONTEXT: ${intent.implied_context || '(none)'}
DESIRED OUTPUT: ${intent.desired_output}
RAW USER MESSAGE: ${userMessage}`;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await withTimeout('classify', opts.timeoutMs, async () => {
        const completion = await generateText({
          model: sdk(opts.model),
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userBlock },
          ],
          temperature: 0.1,
          providerOptions: {
            openai: { responseFormat: { type: 'json_object' } },
          },
          ...(opts.signal && { abortSignal: opts.signal }),
        });
        return parseAndValidate(completion.text);
      });

      const lowConfidence = result.confidence < CONFIDENCE_FLOOR;
      if (lowConfidence) {
        log.warn(
          { confidence: result.confidence, primaryDomain: result.primary_domain },
          'classifier low confidence — caller may coerce to general/moderate',
        );
      }
      return {
        result,
        latencyMs: Date.now() - start,
        fallbackUsed: false,
        lowConfidence,
      };
    } catch (err) {
      lastError = err;
      if (err instanceof IPELayerTimeoutError) {
        log.warn({ attempt, timeoutMs: opts.timeoutMs }, 'classifier timed out');
        break;
      }
      log.warn(
        { attempt, err: err instanceof Error ? err.message : String(err) },
        'classifier attempt failed; will retry if budget remains',
      );
    }
  }

  log.warn(
    { err: lastError instanceof Error ? lastError.message : String(lastError) },
    'classifier exhausted retries — using fallback',
  );
  return {
    result: LOW_CONFIDENCE_FALLBACK,
    latencyMs: Date.now() - start,
    fallbackUsed: true,
    lowConfidence: true,
  };
}

function parseAndValidate(rawText: string): ClassifierResult {
  const stripped = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch (err) {
    throw new Error(
      `Classifier returned non-JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return ClassifierResultSchema.parse(parsed);
}

export const __TEST = {
  SYSTEM_PROMPT,
  parseAndValidate,
  LOW_CONFIDENCE_FALLBACK,
  CONFIDENCE_FLOOR,
};
