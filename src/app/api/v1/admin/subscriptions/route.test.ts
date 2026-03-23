import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { GET } from './route';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

describe('GET /api/v1/admin/subscriptions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns paginated subscriptions', async () => {
    const subs = [{ id: 1, status: 'active' }];
    vi.mocked(prisma.subscription.findMany).mockResolvedValue(subs as any);
    vi.mocked(prisma.subscription.count).mockResolvedValue(1);

    const req = new NextRequest('http://localhost/api/v1/admin/subscriptions?page=1&limit=20');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual(subs);
  });

  it('filters by status', async () => {
    vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);
    vi.mocked(prisma.subscription.count).mockResolvedValue(0);

    const req = new NextRequest('http://localhost/api/v1/admin/subscriptions?status=active');
    const res = await GET(req);

    expect(prisma.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'active' },
      })
    );
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.subscription.findMany).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost/api/v1/admin/subscriptions');
    const res = await GET(req);

    expect(res.status).toBe(500);
  });
});
