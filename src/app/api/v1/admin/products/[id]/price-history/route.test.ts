import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    priceHistory: { findMany: vi.fn() },
  },
}));

import { GET } from './route';
import { prisma } from '@/lib/prisma';

describe('GET /api/v1/admin/products/[id]/price-history', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns price history', async () => {
    const history = [{ id: 1, price: 100, changedAt: '2024-01-01' }];
    vi.mocked(prisma.priceHistory.findMany).mockResolvedValue(history as any);

    const req = new Request('http://localhost');
    const res = await GET(req as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual(history);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost');
    const res = await GET(req as any, { params: Promise.resolve({ id: 'abc' }) });

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.priceHistory.findMany).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost');
    const res = await GET(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(500);
  });
});
