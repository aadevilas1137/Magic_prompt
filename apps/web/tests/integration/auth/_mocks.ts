import { vi } from 'vitest';

/** Reset between tests so per-test stubs don't bleed. */
export function resetSupabaseMocks(): void {
  for (const fn of Object.values(supabaseAuthMocks)) {
    fn.mockReset();
  }
}

/** Stubs for every `supabase.auth.*` method our actions reach. */
export const supabaseAuthMocks = {
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  resend: vi.fn(),
  getUser: vi.fn(),
  getSession: vi.fn(),
};

/**
 * Wire all mocks BEFORE importing any action / page module.
 * Call once at the top of each integration-test file.
 */
export function installAuthMocks(): void {
  vi.mock('next/headers', () => ({
    headers: () => ({
      get: (_name: string) => null,
    }),
    cookies: () => ({
      get: () => undefined,
      getAll: () => [],
      set: () => {},
    }),
  }));

  vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
  }));

  // `redirect` THROWS in real Next.js so we mirror that — tests assert via
  // `expect(...).rejects.toThrow('NEXT_REDIRECT:<url>')`.
  vi.mock('next/navigation', () => ({
    redirect: (url: string) => {
      const err = new Error(`NEXT_REDIRECT:${url}`);
      throw err;
    },
    notFound: () => {
      const err = new Error('NEXT_NOT_FOUND');
      throw err;
    },
  }));

  vi.mock('@/lib/supabase/server', () => ({
    createClient: () => ({
      auth: supabaseAuthMocks,
    }),
  }));
}
