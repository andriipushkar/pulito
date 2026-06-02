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
vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { count: vi.fn(), findFirst: vi.fn() },
    review: { count: vi.fn() },
  },
}));
// Auth model is now a short-lived HttpOnly cookie grant, not a query-string token.
vi.mock('@/services/token', () => ({ verifySseGrantToken: vi.fn() }));
vi.mock('@/utils/cookies', () => ({ getSseGrantFromCookies: vi.fn() }));

import { GET } from './route';
import { verifySseGrantToken } from '@/services/token';
import { getSseGrantFromCookies } from '@/utils/cookies';
import { NextRequest } from 'next/server';

const mockVerify = vi.mocked(verifySseGrantToken);
const mockGetGrant = vi.mocked(getSseGrantFromCookies);

describe('GET /api/v1/admin/notifications/stream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no grant cookie', async () => {
    mockGetGrant.mockReturnValue(null as any);

    const req = new NextRequest('http://localhost/api/v1/admin/notifications/stream');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('returns 401 when grant is invalid', async () => {
    mockGetGrant.mockReturnValue('bad-grant');
    mockVerify.mockImplementation(() => {
      throw new Error('invalid');
    });

    const req = new NextRequest('http://localhost/api/v1/admin/notifications/stream');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('returns 403 when grant scope/role mismatches', async () => {
    mockGetGrant.mockReturnValue('valid-grant');
    mockVerify.mockReturnValue({ scope: 'admin_notifications', role: 'customer' } as any);

    const req = new NextRequest('http://localhost/api/v1/admin/notifications/stream');
    const res = await GET(req);

    expect(res.status).toBe(403);
  });

  it('returns SSE stream for valid admin grant', async () => {
    mockGetGrant.mockReturnValue('valid-grant');
    mockVerify.mockReturnValue({ scope: 'admin_notifications', role: 'admin' } as any);

    const controller = new AbortController();
    const req = new NextRequest('http://localhost/api/v1/admin/notifications/stream', {
      signal: controller.signal,
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toBe('no-cache, no-transform');

    controller.abort();
  });
});
