import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: (..._roles: string[]) => (handler: Function) => handler,
}));

vi.mock('@/services/feature-flag', () => ({
  isFeatureEnabled: vi.fn(),
}));

vi.mock('@/utils/api-response', async () => {
  const { NextResponse } = await import('next/server');
  return {
    successResponse: (data: any, status = 200) => NextResponse.json({ success: true, data }, { status }),
    errorResponse: (message: string, status = 500) => NextResponse.json({ success: false, error: message }, { status }),
  };
});

import { GET } from './route';
import { isFeatureEnabled } from '@/services/feature-flag';

const mockIsEnabled = isFeatureEnabled as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };

describe('GET /api/v1/feature-flags/check', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 without key param', async () => {
    const req = new NextRequest('http://localhost/api/v1/feature-flags/check');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns enabled status', async () => {
    mockIsEnabled.mockResolvedValue(true);
    const req = new NextRequest('http://localhost/api/v1/feature-flags/check?key=new_checkout');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.enabled).toBe(true);
  });

  it('returns 500 on error', async () => {
    mockIsEnabled.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/feature-flags/check?key=test');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
