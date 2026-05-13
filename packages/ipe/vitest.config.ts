import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', 'dist/**', '.turbo/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      // Phase 4 IPE is the competitive moat — bar higher than the web app's
      // 55/50/55/55. Layers + templates are pure code, easy to cover well.
      thresholds: { lines: 70, branches: 60, functions: 70, statements: 70 },
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/index.ts',
        // Layer 4 is a thin LLM-router wrapper; covered through the pipeline
        // end-to-end test rather than directly (mocking the real LLM adds noise).
        'src/layers/4-llm-router.ts',
        // service-role DB client is exercised by an integration probe in
        // tooling/scripts/verify-ipe-schema.ts; not unit-mockable cleanly.
        'src/lib/service-role-db.ts',
      ],
    },
  },
});
