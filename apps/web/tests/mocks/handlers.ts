import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/health', () =>
    HttpResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.0.0-test',
      db: 'disconnected',
      runtime: 'nodejs',
      env: 'test',
    }),
  ),
];
