import { describe, expect, it, vi } from 'vitest';

import { compactProperties, trackChatEvent } from '@/features/chat/lib/analytics';

vi.mock('@magic-prompt/analytics', () => ({
  track: vi.fn(),
}));

describe('compactProperties', () => {
  it('strips undefined-valued keys', () => {
    const out = compactProperties({ a: 1, b: undefined, c: 'x' });
    expect(out).toEqual({ a: 1, c: 'x' });
  });

  it('preserves null and 0 and empty string', () => {
    const out = compactProperties({ a: 0, b: '', c: null });
    expect(out).toEqual({ a: 0, b: '', c: null });
  });

  it('handles empty input', () => {
    expect(compactProperties({})).toEqual({});
  });
});

describe('trackChatEvent', () => {
  it('forwards distinctId + event + properties to track()', async () => {
    const { track } = await import('@magic-prompt/analytics');
    vi.mocked(track).mockClear();
    trackChatEvent({
      distinctId: 'user-1',
      event: 'chat.created',
      properties: { chatId: 'c1' },
    });
    expect(vi.mocked(track)).toHaveBeenCalledWith({
      distinctId: 'user-1',
      event: 'chat.created',
      properties: { chatId: 'c1' },
    });
  });

  it('omits the properties key when not provided', async () => {
    const { track } = await import('@magic-prompt/analytics');
    vi.mocked(track).mockClear();
    trackChatEvent({ distinctId: 'u', event: 'chat.opened' });
    expect(vi.mocked(track)).toHaveBeenCalledWith({ distinctId: 'u', event: 'chat.opened' });
  });

  it('swallows errors so analytics never breaks chat flow', async () => {
    const { track } = await import('@magic-prompt/analytics');
    vi.mocked(track).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(() => trackChatEvent({ distinctId: 'u', event: 'chat.created' })).not.toThrow();
  });
});
