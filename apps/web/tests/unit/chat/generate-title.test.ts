import { describe, expect, it } from 'vitest';

import { cleanTitle, isDefaultTitle } from '@/features/chat/lib/generate-title';

describe('isDefaultTitle', () => {
  it.each([
    [null, true],
    [undefined, true],
    ['', true],
    ['  ', true],
    ['New chat', true],
    ['new chat', true],
    ['NEW CHAT', true],
    ['Customer onboarding', false],
    ['New chat ideas', false],
  ])('isDefaultTitle(%j) → %s', (input, expected) => {
    expect(isDefaultTitle(input as string | null | undefined)).toBe(expected);
  });
});

describe('cleanTitle', () => {
  it('strips surrounding whitespace + quotes + trailing punctuation', () => {
    expect(cleanTitle('"Hello world."')).toBe('Hello world');
    expect(cleanTitle('  Onboarding flow!  ')).toBe('Onboarding flow');
    expect(cleanTitle("'It's a title'")).toBe("It's a title");
  });

  it('collapses internal whitespace', () => {
    expect(cleanTitle('Multi\n\n  line\ttitle')).toBe('Multi line title');
  });

  it('caps at 80 chars', () => {
    const long = 'a'.repeat(120);
    const cleaned = cleanTitle(long);
    expect(cleaned.length).toBe(80);
  });

  it('handles empty input', () => {
    expect(cleanTitle('')).toBe('');
    expect(cleanTitle('   ')).toBe('');
  });
});
