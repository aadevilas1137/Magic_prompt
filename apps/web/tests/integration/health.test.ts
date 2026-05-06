import { describe, expect, it } from 'vitest';

import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      timestamp: string;
      version: string;
      db: 'connected' | 'disconnected';
      runtime: string;
    };
    expect(body.status).toBe('ok');
    expect(body.runtime).toBe('nodejs');
    expect(body.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(['connected', 'disconnected']).toContain(body.db);
  });
});
