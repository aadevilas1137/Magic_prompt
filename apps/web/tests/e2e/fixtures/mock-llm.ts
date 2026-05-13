import type { Page } from '@playwright/test';

/**
 * Playwright fixture: intercept `/api/chat` POSTs and reply with a fake
 * AI-SDK UI-message stream. No real OpenAI calls = no quota burn, no
 * flakiness, deterministic assertions.
 *
 * The stream format follows AI SDK v6's UIMessage stream (`text-delta`
 * events). Phase 5+ may swap to the data-stream protocol; update the
 * encoder here in lockstep.
 */
export async function mockChatRoute(
  page: Page,
  options: {
    readonly response?: string;
    readonly delayMs?: number;
  } = {},
): Promise<void> {
  const response =
    options.response ?? 'This is a mocked assistant response. Markdown **renders** correctly.';
  const delayMs = options.delayMs ?? 50;

  await page.route('**/api/chat', async (route) => {
    // Build a UIMessageStream-compatible body. Each chunk is JSON on a
    // dedicated SSE line; the client deserialises via the AI SDK.
    const chunks: string[] = [];
    const messageId = 'mock-assistant-msg';
    chunks.push(`data: ${JSON.stringify({ type: 'start' })}\n\n`);
    chunks.push(`data: ${JSON.stringify({ type: 'start-step', messageId })}\n\n`);
    chunks.push(`data: ${JSON.stringify({ type: 'text-start', id: 'mock-text' })}\n\n`);
    // Emit text in small deltas to exercise the streaming path.
    const words = response.split(' ');
    for (const w of words) {
      chunks.push(
        `data: ${JSON.stringify({ type: 'text-delta', id: 'mock-text', delta: `${w} ` })}\n\n`,
      );
    }
    chunks.push(`data: ${JSON.stringify({ type: 'text-end', id: 'mock-text' })}\n\n`);
    chunks.push(`data: ${JSON.stringify({ type: 'finish-step' })}\n\n`);
    chunks.push(`data: ${JSON.stringify({ type: 'finish' })}\n\n`);
    chunks.push('data: [DONE]\n\n');

    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Vercel-AI-UI-Message-Stream': 'v1',
      },
      body: chunks.join(''),
    });
  });
}
