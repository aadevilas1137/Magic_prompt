import { describe, expect, it } from 'vitest';

import { buildLLMContext, SYSTEM_PROMPT } from '@/features/chat/lib/truncate-context';

function msg(role: 'user' | 'assistant' | 'system', content: string, error: string | null = null) {
  return { role, content, error };
}

describe('buildLLMContext', () => {
  it('prepends the system prompt as the first message', () => {
    const out = buildLLMContext([msg('user', 'hi')], 20);
    expect(out[0]?.role).toBe('system');
    expect(out[0]?.content).toBe(SYSTEM_PROMPT);
  });

  it('drops messages with non-null `error` (partial / failed turns)', () => {
    const out = buildLLMContext(
      [msg('user', 'q1'), msg('assistant', 'partial', 'stream failed'), msg('user', 'q2')],
      20,
    );
    expect(out.length).toBe(3);
    expect(out.map((m) => m.content)).toEqual([SYSTEM_PROMPT, 'q1', 'q2']);
  });

  it('drops messages with empty content', () => {
    const out = buildLLMContext([msg('user', 'real'), msg('assistant', '')], 20);
    expect(out.length).toBe(2);
    expect(out[1]?.content).toBe('real');
  });

  it('keeps only the trailing windowSize messages', () => {
    const history = Array.from({ length: 10 }, (_, i) => msg('user', `q${i}`));
    const out = buildLLMContext(history, 3);
    // 1 system + 3 from tail
    expect(out.length).toBe(4);
    expect(out.map((m) => m.content).slice(1)).toEqual(['q7', 'q8', 'q9']);
  });

  it('handles windowSize >= history length without padding', () => {
    const out = buildLLMContext([msg('user', 'only')], 100);
    expect(out.length).toBe(2);
  });
});
