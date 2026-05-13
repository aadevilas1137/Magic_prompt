import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

import { ipeLogger } from '../lib/logger';
import { withTimeout, IPELayerTimeoutError } from '../lib/timeout';
import { IntentParserResultSchema, type IntentParserResult } from '../types';

const log = ipeLogger.child({ layer: 'intent' });

const SYSTEM_PROMPT = `You are an Intent Parser for an AI prompt engineering pipeline. Your job is to extract structured intent from a user's natural-language request so the next stages can route + enrich it.

Output STRICT JSON matching this schema (no markdown, no commentary):
{
  "intent": "string — the user's core goal in 3-7 words, present-tense imperative",
  "implied_context": "string ≤ 200 chars — the industry / domain / scenario the user assumes",
  "desired_output": "production_code | content | document | analysis | explanation | recommendation | other",
  "missing_params": ["string array — important info the user didn't specify, max 6 items, each ≤ 80 chars"],
  "confidence": "number 0.0-1.0 — your certainty that intent + context are correct"
}

Rules:
- Be specific in "intent" (e.g. "build real estate listing site", not "build website").
- "missing_params" should contain concrete items the user likely cares about but didn't say. Examples: target audience, design style, tech stack, length, tone.
- If the input is empty or nonsensical, return confidence < 0.3 and a generic intent.
- Never include quotes or special characters that would break JSON parsing.`;

export interface IntentParserOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly timeoutMs: number;
  readonly retries?: number;
  readonly signal?: AbortSignal;
}

export interface IntentParserOutput {
  readonly result: IntentParserResult;
  readonly latencyMs: number;
  readonly fallbackUsed: boolean;
}

const DEFAULT_FALLBACK = (userMessage: string): IntentParserResult => ({
  intent: userMessage.trim().slice(0, 120) || 'respond to user',
  implied_context: '',
  desired_output: 'other',
  missing_params: [],
  confidence: 0.0,
});

/**
 * Layer 1 — extract structured intent from raw user input.
 *
 * Calls `gpt-4o-mini` with JSON mode + a strict Zod-validated output schema.
 * On parse failure, retries once. On total failure (timeout / persistent
 * malformed JSON / abort), returns a default result with `fallbackUsed=true`
 * so Layer 2 still has *something* to classify. The caller logs the
 * fallback so we can monitor pipeline health.
 */
export async function runIntentParser(
  userMessage: string,
  opts: IntentParserOptions,
): Promise<IntentParserOutput> {
  const start = Date.now();
  const maxRetries = opts.retries ?? 1;
  const sdk = createOpenAI({ apiKey: opts.apiKey });

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await withTimeout('intent', opts.timeoutMs, async () => {
        const completion = await generateText({
          model: sdk(opts.model),
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.2,
          providerOptions: {
            openai: { responseFormat: { type: 'json_object' } },
          },
          ...(opts.signal && { abortSignal: opts.signal }),
        });
        return parseAndValidate(completion.text);
      });

      return {
        result,
        latencyMs: Date.now() - start,
        fallbackUsed: false,
      };
    } catch (err) {
      lastError = err;
      if (err instanceof IPELayerTimeoutError) {
        log.warn({ attempt, timeoutMs: opts.timeoutMs }, 'intent parser timed out');
        // No retry on timeout — would just blow the budget twice.
        break;
      }
      log.warn(
        { attempt, err: err instanceof Error ? err.message : String(err) },
        'intent parser attempt failed; will retry if budget remains',
      );
    }
  }

  log.warn(
    { err: lastError instanceof Error ? lastError.message : String(lastError) },
    'intent parser exhausted retries — using fallback',
  );
  return {
    result: DEFAULT_FALLBACK(userMessage),
    latencyMs: Date.now() - start,
    fallbackUsed: true,
  };
}

function parseAndValidate(rawText: string): IntentParserResult {
  // Strip any code-fence wrappers the LLM may have added against instructions.
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
      `Intent parser returned non-JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  // Zod validation — schema errors throw with the original Zod issues, useful
  // in logs but never propagated to the user.
  return IntentParserResultSchema.parse(parsed);
}

// Exported for unit tests only.
export const __TEST = {
  SYSTEM_PROMPT,
  parseAndValidate,
  DEFAULT_FALLBACK,
};
