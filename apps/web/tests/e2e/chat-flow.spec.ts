import { expect, test } from '@playwright/test';

/**
 * Phase 3 E2E — chat surface smoke tests.
 *
 * Two test classes:
 *   1. **Always-on (no auth required)** — verifies route protection and
 *      the /api/chat contract for anonymous callers. These run in CI.
 *   2. **Authenticated flow (skipped unless E2E_AUTH_EMAIL/PASSWORD set)**
 *      — full streaming chat flow with the `/api/chat` request mocked via
 *      Playwright route handlers (no OpenAI quota burn). Requires a real
 *      Supabase test account to log in. Document the secrets and run
 *      locally; CI runs only when SUPABASE_TEST_ENABLED=true (Phase 2.5
 *      gate) and the auth credentials are present.
 *
 *  Test scenarios documented in PHASE_3_SPEC §"E2E Tests" — full coverage
 *  awaits the dedicated Supabase test project (Phase 3.5 follow-up).
 */

test.describe('chat route protection (unauth)', () => {
  test('GET /chat redirects to /login with ?redirect=/chat', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForURL(/\/login/);
    expect(page.url()).toMatch(/redirect=/);
  });

  test('GET /chat/new redirects to /login when unauthenticated', async ({ page }) => {
    await page.goto('/chat/new');
    await page.waitForURL(/\/login/);
  });

  test('GET /chat/[chatId] redirects to /login when unauthenticated', async ({ page }) => {
    await page.goto('/chat/00000000-0000-0000-0000-000000000000');
    await page.waitForURL(/\/login/);
  });

  test('POST /api/chat returns 401 for unauthenticated callers', async ({ request }) => {
    const res = await request.post('/api/chat', {
      data: {
        chatId: '00000000-0000-0000-0000-000000000000',
        messages: [{ role: 'user', content: 'hi' }],
      },
    });
    expect(res.status()).toBe(401);
  });

  test('POST /api/chat rejects malformed bodies with 400', async ({ request }) => {
    const res = await request.post('/api/chat', { data: { bogus: true } });
    // The validation runs *after* JSON parsing but before auth, so we expect 400
    // (validation error) for shape mismatch.
    expect(res.status()).toBe(400);
  });
});

const authEmail = process.env.E2E_AUTH_EMAIL;
const authPassword = process.env.E2E_AUTH_PASSWORD;
const authSpecsEnabled = Boolean(authEmail && authPassword);

test.describe('authenticated chat flow', () => {
  test.skip(!authSpecsEnabled, 'Set E2E_AUTH_EMAIL + E2E_AUTH_PASSWORD to run authed flow specs.');

  test('signed-in user lands on /chat welcome and can create a new chat', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(authEmail!);
    await page.getByLabel(/password/i).fill(authPassword!);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/chat/);
    await expect(page.getByText(/what's on your mind/i)).toBeVisible();
  });
});
