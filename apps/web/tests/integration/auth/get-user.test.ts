import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { installAuthMocks, resetSupabaseMocks, supabaseAuthMocks } from './_mocks';

installAuthMocks();

const { getUser } = await import('@/lib/auth/get-user');
const { getSession } = await import('@/lib/auth/session');
const { requireUser } = await import('@/lib/auth/require-user');

beforeEach(() => resetSupabaseMocks());
afterEach(() => resetSupabaseMocks());

describe('getUser', () => {
  it('returns null when supabase reports an error', async () => {
    supabaseAuthMocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { code: 'session_not_found', message: 'no' },
    });
    expect(await getUser()).toBeNull();
  });

  it('returns null when user is missing', async () => {
    supabaseAuthMocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    expect(await getUser()).toBeNull();
  });

  it('returns the user on success', async () => {
    const fakeUser = { id: 'abc', email: 'a@b.com' };
    supabaseAuthMocks.getUser.mockResolvedValueOnce({
      data: { user: fakeUser },
      error: null,
    });
    const result = await getUser();
    expect(result).toEqual(fakeUser);
  });
});

describe('getSession', () => {
  it('returns null when no session', async () => {
    supabaseAuthMocks.getSession.mockResolvedValueOnce({ data: { session: null } });
    expect(await getSession()).toBeNull();
  });
});

describe('requireUser', () => {
  it('redirects when no user is present', async () => {
    supabaseAuthMocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    await expect(requireUser('/chat')).rejects.toThrow(/NEXT_REDIRECT:\/login/);
  });

  it('returns the user when authenticated', async () => {
    const fakeUser = { id: 'abc', email: 'a@b.com' };
    supabaseAuthMocks.getUser.mockResolvedValueOnce({
      data: { user: fakeUser },
      error: null,
    });
    const result = await requireUser('/chat');
    expect(result).toEqual(fakeUser);
  });
});
