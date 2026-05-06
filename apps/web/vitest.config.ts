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
      // Lenient in Phase 1; tighten to lines:80 / branches:75 in later phases.
      thresholds: { lines: 0, branches: 0, functions: 0, statements: 0 },
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.config.*',
        'src/**/index.ts',
        'src/middleware.ts',
        'src/i18n/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
