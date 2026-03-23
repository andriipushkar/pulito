import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { groupBy: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));
vi.mock('@/utils/api-response', () => ({
  successResponse: (data: any, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));

import { GET } from './route';
import { prisma } from '@/lib/prisma';

describe('GET /api/v1/admin/analytics/churn', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns churn analytics on success', async () => {
    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 45);

    (prisma.order.groupBy as any).mockResolvedValue([
      {
        userId: 1,
        _count: { id: 3 },
        _sum: { totalAmount: 1500 },
        _max: { createdAt: pastDate },
        _min: { createdAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) },
      },
    ]);
    (prisma.user.findMany as any).mockResolvedValue([]);

    const req = new Request('http://localhost/api/v1/admin/analytics/churn?days=90');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveProperty('churnRate');
    expect(data).toHaveProperty('retentionRate');
    expect(data).toHaveProperty('atRiskCustomers');
    expect(data).toHaveProperty('churnByMonth');
  });

  it('returns 500 on error', async () => {
    (prisma.order.groupBy as any).mockRejectedValue(new Error('DB error'));

    const req = new Request('http://localhost/api/v1/admin/analytics/churn');
    const res = await GET(req);

    expect(res.status).toBe(500);
  });
});
