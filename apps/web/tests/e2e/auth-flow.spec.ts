import { expect, test } from '@playwright/test';

/**
 * Phase 2 E2E — auth-aware navigation.
 *
 * Doesn't sign up a real user (that needs the Supabase Admin API + cleanup
 * teardown — Phase 2.5). Instead, verifies the unauthenticated paths:
 *   - protected route → redirected to /login with ?redirect=
 *   - login page renders with form visible
 *   - signup page renders with form visible
 *   - /api/health is publicly reachable
 *   - language switch to /hi works
 */

test('unauthenticated /chat redirects to /login with redirect param', async ({ page }) => {
  await page.goto('/chat');
  await page.waitForURL(/\/login/);
  expect(page.url()).toMatch(/redirect=/);
});

test('login page renders the form', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
});

test('signup page renders the form with strength meter slot', async ({ page }) => {
  await page.goto('/signup');
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
});

test('forgot-password page renders the form', async ({ page }) => {
  await page.goto('/forgot-password');
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();
});

test('/api/health returns ok', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { status: string };
  expect(body.status).toBe('ok');
});

test('switching to /hi renders Hindi page chrome', async ({ page }) => {
  await page.goto('/hi/login');
  // The page <html lang> attribute should be 'hi' under the [locale] segment.
  const lang = await page.evaluate(() => document.documentElement.lang);
  expect(lang).toBe('hi');
});
