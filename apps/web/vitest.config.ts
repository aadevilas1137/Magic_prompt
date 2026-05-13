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
      // Phase 4 tightening — bumping from 50/45/50/50 to 55/50/55/55 per spec.
      // Final target per ADR-0005 is lines:80 / branches:75.
      thresholds: { lines: 55, branches: 50, functions: 55, statements: 55 },
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
        // app/ pages — mostly RSC composition with minimal logic.
        'src/app/**',
        // Layout client components — covered via E2E.
        'src/components/layout/**',
        // Auth UI components — covered via E2E.
        'src/features/auth/components/**',
        // Chat UI components + hooks — covered via E2E and (for the
        // markdown renderer) a dedicated XSS-defence unit suite.
        'src/features/chat/components/**',
        'src/features/chat/hooks/**',
        // Server actions and queries — exercised via E2E flows; unit-mocking
        // Drizzle + Supabase JS at this layer is high-cost / low-signal.
        'src/features/chat/actions/**',
        'src/features/chat/queries/**',
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
