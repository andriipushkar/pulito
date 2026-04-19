import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
    APP_URL: 'https://test.com',
    CRON_SECRET: 'test-cron-secret',
    APP_SECRET: 'test-app-secret',
  },
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole:
    (..._roles: string[]) =>
    (handler: Function) =>
      handler,
}));

vi.mock('@/services/auth', () => ({
  getLoginHistory: vi.fn(),
}));

vi.mock('@/utils/api-response', async () => {
  const { NextResponse } = await import('next/server');
  return {
    successResponse: (data: any, status = 200) =>
      NextResponse.json({ success: true, data }, { status }),
    errorResponse: (message: string, status = 500) =>
      NextResponse.json({ success: false, error: message }, { status }),
  };
});

import { GET } from './route';
import { getLoginHistory } from '@/services/auth';

const mockGetLoginHistory = getLoginHistory as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };

describe('GET /api/v1/me/login-history', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns login history', async () => {
    const history = [{ id: 1, ip: '127.0.0.1', createdAt: new Date().toISOString() }];
    mockGetLoginHistory.mockResolvedValue(history);
    const req = new Request('http://localhost');
    const res = await GET(req as any, authCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual(history);
  });

  it('returns 500 on error', async () => {
    mockGetLoginHistory.mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost');
    const res = await GET(req as any, authCtx as any);
    expect(res.status).toBe(500);
  });
});
