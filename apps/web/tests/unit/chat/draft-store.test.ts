import { beforeEach, describe, expect, it } from 'vitest';

import { useDraftStore, NEW_CHAT_DRAFT_KEY } from '@/features/chat/stores/draft-store';

describe('useDraftStore', () => {
  beforeEach(() => {
    useDraftStore.setState({ drafts: {} });
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });

  it('returns empty string for unknown chatId', () => {
    expect(useDraftStore.getState().getDraft('unknown')).toBe('');
  });

  it('setDraft / getDraft round-trip', () => {
    useDraftStore.getState().setDraft('c1', 'hello');
    expect(useDraftStore.getState().getDraft('c1')).toBe('hello');
  });

  it('keeps drafts isolated per chatId', () => {
    useDraftStore.getState().setDraft('a', 'A draft');
    useDraftStore.getState().setDraft('b', 'B draft');
    expect(useDraftStore.getState().getDraft('a')).toBe('A draft');
    expect(useDraftStore.getState().getDraft('b')).toBe('B draft');
  });

  it('clearDraft removes a single draft only', () => {
    useDraftStore.getState().setDraft('a', 'A');
    useDraftStore.getState().setDraft('b', 'B');
    useDraftStore.getState().clearDraft('a');
    expect(useDraftStore.getState().getDraft('a')).toBe('');
    expect(useDraftStore.getState().getDraft('b')).toBe('B');
  });

  it('clearDraft is a no-op when key was never set', () => {
    useDraftStore.getState().clearDraft('missing');
    expect(useDraftStore.getState().drafts).toEqual({});
  });

  it('exports the NEW_CHAT_DRAFT_KEY sentinel', () => {
    expect(NEW_CHAT_DRAFT_KEY).toBe('__new__');
  });
});
