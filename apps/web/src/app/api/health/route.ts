import { NextResponse } from 'next/server';

import { env, isDatabaseConfigured } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface HealthResponse {
  readonly status: 'ok';
  readonly timestamp: string;
  readonly version: string;
  readonly db: 'connected' | 'disconnected';
  readonly runtime: 'nodejs';
  readonly env: 'development' | 'test' | 'production';
}

export function GET(): NextResponse<HealthResponse> {
  const body: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.1.0',
    db: isDatabaseConfigured ? 'connected' : 'disconnected',
    runtime: 'nodejs',
    env: env.NODE_ENV,
  };
  return NextResponse.json(body);
}
