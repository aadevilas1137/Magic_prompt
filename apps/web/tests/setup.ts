import '@testing-library/jest-dom/vitest';

import { afterAll, afterEach, beforeAll, vi } from 'vitest';

import { server } from './mocks/server';

// `server-only` throws if imported into a non-server-runtime module, but in
// vitest we import server-side modules directly. Stub it out for the whole
// test suite. Same for `client-only` for completeness.
vi.mock('server-only', () => ({}));
vi.mock('client-only', () => ({}));

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
