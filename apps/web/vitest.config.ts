import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**', '.next/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      // Phase 2 tightening — Phase 1 was 0/0/0/0; final target per ADR-0005
      // is lines:80 / branches:75. Bumping mid-phase as we grow tests.
      thresholds: { lines: 40, branches: 35, functions: 40, statements: 40 },
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.config.*',
        'src/**/index.ts',
        'src/middleware.ts',
        'src/i18n/**',
        // shadcn primitives — we don't author this code; tests upstream cover
        // the contracts. Re-include if we ever fork a component.
        'src/components/ui/**',
        // app/ pages — mostly RSC composition with minimal logic. Coverage
        // here is mostly noise (forms/components are tested separately).
        'src/app/**',
        // Layout client components — covered via E2E in CI when secrets exist.
        'src/components/layout/**',
        // Auth UI components are React Hook Form + Server Actions; their
        // behavior is exercised in the E2E job. Component-level unit tests
        // are a Phase 2.5 follow-up.
        'src/features/auth/components/**',
        // Hooks placeholders.
        'src/features/chat/**',
        'src/hooks/**',
        'src/stores/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './tests/stubs/server-only.ts'),
      'client-only': path.resolve(__dirname, './tests/stubs/server-only.ts'),
    },
  },
});
