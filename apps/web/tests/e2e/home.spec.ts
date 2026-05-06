import { expect, test } from '@playwright/test';

test('chat page loads with the app title and is free of console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/chat');
  await expect(page.getByRole('heading', { level: 1, name: 'Magic Prompt AI' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('/api/health returns ok', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { status: string };
  expect(body.status).toBe('ok');
});
