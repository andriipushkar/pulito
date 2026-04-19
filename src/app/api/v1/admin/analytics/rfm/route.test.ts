import { NextRequest } from 'next/server';
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
  withRole:
    (..._roles: string[]) =>
    (handler: any) =>
      handler,
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { groupBy: vi.fn() },
  },
}));
vi.mock('@/utils/api-response', () => ({
  successResponse: (data: any, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));

import { GET } from './route';
import { prisma } from '@/lib/prisma';

describe('GET /api/v1/admin/analytics/rfm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns RFM segments on success', async () => {
    const now = new Date();
    (prisma.order.groupBy as any).mockResolvedValue([
      { userId: 1, _count: { id: 5 }, _sum: { totalAmount: 5000 }, _max: { createdAt: now } },
      {
        userId: 2,
        _count: { id: 1 },
        _sum: { totalAmount: 200 },
        _max: { createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) },
      },
    ]);

    const req = new NextRequest('http://localhost/api/v1/admin/analytics/rfm?days=90');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveProperty('segments');
    expect(data).toHaveProperty('totalCustomers');
  });

  it('returns 500 on error', async () => {
    (prisma.order.groupBy as any).mockRejectedValue(new Error('DB error'));

    const req = new NextRequest('http://localhost/api/v1/admin/analytics/rfm');
    const res = await GET(req);

    expect(res.status).toBe(500);
  });
});
