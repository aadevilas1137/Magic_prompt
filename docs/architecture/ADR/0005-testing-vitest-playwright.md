# ADR-0005: Testing stack — Vitest + Playwright + MSW

- **Status:** Accepted
- **Date:** 2026-05-05
- **Phase:** 1

## Context

Three testing layers, three tools chosen for each:

| Layer       | Tool         | Runs against                              |
| ----------- | ------------ | ----------------------------------------- |
| Unit        | Vitest       | Pure functions, hooks, components (jsdom) |
| Integration | Vitest + MSW | Route handlers, query/mutation flows      |
| E2E         | Playwright   | Real browser against `pnpm dev`           |

## Decision

- **Vitest** for unit + integration. Vite-style config, native ESM, fast watch mode, drop-in `expect` API.
- **MSW** for HTTP mocking (in unit/integration). Same handlers usable in Storybook later.
- **Playwright** for E2E. Cross-browser, mobile viewports, traces on first retry.
- **Testing Library** for React component assertions.
- Coverage via **v8** (Vitest's built-in `--coverage`).

## Consequences

### Positive

- Vitest reuses our existing Vite resolution (path aliases, `transpilePackages`-style behaviour), so tests "just work" on the workspace TS source.
- MSW lives at the network layer, so tests exercise real fetch flows rather than monkey-patched modules.
- Playwright traces are good enough that flaky tests are rarely a real mystery.
- One coverage tool (v8) across unit and integration.

### Negative / accepted trade-offs

- Vitest's API is a moving target — new versions occasionally tighten types we relied on.
- MSW v2 broke handler signatures — our handlers use the v2 API and we'll keep them on a single major.
- E2E adds installation footprint (Playwright browsers ~ 200 MB). CI installs them only on the e2e job.

## Phase 1 thresholds

Lenient: `lines/branches/functions/statements: 0`. We tighten phase by phase. Final target: `lines: 80`, `branches: 75`.

## Alternatives considered

- **Jest** — slower in watch mode, ESM/TS path resolution still requires babel-jest gymnastics in monorepos.
- **Cypress** — capable, but Playwright's parallel + trace story is better for CI today.
- **Webdriver-based tools** — too much wiring.

## References

- [Vitest](https://vitest.dev/)
- [Playwright](https://playwright.dev/)
- [MSW](https://mswjs.io/)
