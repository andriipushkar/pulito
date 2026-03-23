import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    marketplaceReturn: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));
vi.mock('@/utils/api-response', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/api-response')>();
  return { ...actual };
});

import { GET } from './route';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

describe('GET /api/v1/admin/marketplaces/returns', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns paginated returns', async () => {
    const returns = [{ id: 1, status: 'pending' }];
    vi.mocked(prisma.marketplaceReturn.findMany).mockResolvedValue(returns as any);
    vi.mocked(prisma.marketplaceReturn.count).mockResolvedValue(1);

    const req = new NextRequest('http://localhost/api/v1/admin/marketplaces/returns?page=1&limit=10');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual(returns);
  });

  it('filters by status and platform', async () => {
    vi.mocked(prisma.marketplaceReturn.findMany).mockResolvedValue([]);
    vi.mocked(prisma.marketplaceReturn.count).mockResolvedValue(0);

    const req = new NextRequest('http://localhost/api/v1/admin/marketplaces/returns?status=pending&platform=olx');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(prisma.marketplaceReturn.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'pending', connection: { platform: 'olx' } },
      })
    );
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.marketplaceReturn.findMany).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost/api/v1/admin/marketplaces/returns');
    const res = await GET(req);

    expect(res.status).toBe(500);
  });
});
