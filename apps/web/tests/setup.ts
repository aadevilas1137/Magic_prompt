import '@testing-library/jest-dom/vitest';

import { afterAll, afterEach, beforeAll, vi } from 'vitest';

import { server } from './mocks/server';

// Seed env vars required by the production env schema BEFORE any import of
// src/lib/env.ts. Real values are not used (the LLM SDK is mocked in tests);
// the validator just needs the shape to be correct.
process.env['OPENAI_API_KEY'] ||= 'sk-test-stub-key-for-vitest-only-do-not-use';
process.env['OPENAI_MODEL'] ||= 'gpt-4o';
process.env['OPENAI_TITLE_MODEL'] ||= 'gpt-4o-mini';
process.env['CHAT_CONTEXT_WINDOW'] ||= '20';
process.env['CHAT_MAX_MESSAGE_LENGTH'] ||= '8000';

// `server-only` throws if imported into a non-server-runtime module, but in
// vitest we import server-side modules directly. Stub it out for the whole
// test suite. Same for `client-only` for completeness.
vi.mock('server-only', () => ({}));
vi.mock('client-only', () => ({}));

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
