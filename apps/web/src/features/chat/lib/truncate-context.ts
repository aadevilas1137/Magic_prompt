import type { LLMMessage } from '@magic-prompt/llm';
import type { Message } from '@magic-prompt/shared';

const SYSTEM_PROMPT =
  'You are Magic Prompt AI, a helpful and concise assistant. ' +
  'Answer in clean Markdown when formatting helps. ' +
  'Be honest about uncertainty.';

/**
 * Build the LLM message list for a chat turn.
 *
 * Takes the persisted message history (oldest → newest) and:
 *   - Drops any messages with `error` set (partial / failed turns shouldn't be replayed)
 *   - Drops empty `content` (defence — should never persist anyway)
 *   - Keeps only the last `windowSize` messages
 *   - Prepends a static system prompt
 *
 * The static system prompt is a Phase 3 stand-in. Phase 4 (IPE) will replace
 * it with a dynamic enrichment built from the user's input.
 */
export function buildLLMContext(
  history: readonly Pick<Message, 'role' | 'content' | 'error'>[],
  windowSize: number,
): readonly LLMMessage[] {
  const usable = history.filter((m) => !m.error && m.content.length > 0);
  const tail = usable.slice(Math.max(0, usable.length - windowSize));
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    ...tail.map((m) => ({ role: m.role, content: m.content })),
  ];
}

export { SYSTEM_PROMPT };
