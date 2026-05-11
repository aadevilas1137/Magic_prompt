import { beforeEach, describe, expect, it } from 'vitest';

import { useActiveChatStore } from '@/features/chat/stores/active-chat-store';

describe('useActiveChatStore', () => {
  beforeEach(() => {
    useActiveChatStore.setState({ activeChatId: null });
  });

  it('starts with no active chat', () => {
    expect(useActiveChatStore.getState().activeChatId).toBeNull();
  });

  it('setActiveChatId stores the id', () => {
    useActiveChatStore.getState().setActiveChatId('abc');
    expect(useActiveChatStore.getState().activeChatId).toBe('abc');
  });

  it('setActiveChatId(null) clears', () => {
    useActiveChatStore.getState().setActiveChatId('x');
    useActiveChatStore.getState().setActiveChatId(null);
    expect(useActiveChatStore.getState().activeChatId).toBeNull();
  });
});
