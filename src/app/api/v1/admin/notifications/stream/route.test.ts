import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { count: vi.fn(), findFirst: vi.fn() },
    review: { count: vi.fn() },
  },
}));
vi.mock('@/services/token', () => ({ verifyAccessToken: vi.fn() }));

import { GET } from './route';
import { verifyAccessToken } from '@/services/token';
import { NextRequest } from 'next/server';

const mockVerify = vi.mocked(verifyAccessToken);

describe('GET /api/v1/admin/notifications/stream', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 401 when no token', async () => {
    const req = new NextRequest('http://localhost/api/v1/admin/notifications/stream');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    mockVerify.mockImplementation(() => { throw new Error('invalid'); });

    const req = new NextRequest('http://localhost/api/v1/admin/notifications/stream?token=bad');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not admin/manager', async () => {
    mockVerify.mockReturnValue({ role: 'customer', sub: '1' } as any);

    const req = new NextRequest('http://localhost/api/v1/admin/notifications/stream?token=valid');
    const res = await GET(req);

    expect(res.status).toBe(403);
  });

  it('returns SSE stream for admin', async () => {
    mockVerify.mockReturnValue({ role: 'admin', sub: '1' } as any);

    const controller = new AbortController();
    const req = new NextRequest('http://localhost/api/v1/admin/notifications/stream?token=valid', {
      signal: controller.signal,
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toBe('no-cache, no-transform');

    controller.abort();
  });
});
