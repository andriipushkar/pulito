import { describe, it, expect, vi, beforeEach } from 'vitest';

 
vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: any) => handler }));
vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
    APP_URL: 'https://test.com',
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
  },
}));

const cacheGetMock = vi.fn();
const cacheSetMock = vi.fn();
vi.mock('@/services/cache', () => ({
  cacheGet: (k: string) => cacheGetMock(k),
  cacheSet: (k: string, v: unknown, ttl: number) => cacheSetMock(k, v, ttl),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { count: vi.fn() },
    order: { count: vi.fn() },
    category: { count: vi.fn() },
    user: { count: vi.fn() },
  },
}));

import { GET } from './route';
import { prisma } from '@/lib/prisma';

describe('GET /api/v1/admin/dashboard/recommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheGetMock.mockResolvedValue(null);
    cacheSetMock.mockResolvedValue(undefined);
  });

  it('returns cached recommendations when present and skips DB', async () => {
    const cached = [
      { key: 'cached', label: 'cached', href: '/x', count: 1, severity: 'info' },
    ];
    cacheGetMock.mockResolvedValueOnce(cached);
     
    const res = await GET(new Request('http://localhost/x') as any);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toEqual(cached);
    expect(prisma.product.count).not.toHaveBeenCalled();
    expect(cacheSetMock).not.toHaveBeenCalled();
  });

  it('aggregates counts, sorts by severity, caches result and trims to top 5', async () => {
    // 6 metrics: 4 product-counts + 1 order + 1 category + 1 user.
    // Returns are ordered to match the route's Promise.all destructuring.
    vi.mocked(prisma.product.count)
      .mockResolvedValueOnce(30) // productsNoImage (warning: >20)
      .mockResolvedValueOnce(7) // productsNoCategory (warning)
      .mockResolvedValueOnce(2); // productsZeroSales (info)
    vi.mocked(prisma.order.count).mockResolvedValueOnce(10); // ordersUnpaid (danger: >5)
    vi.mocked(prisma.category.count).mockResolvedValueOnce(4); // categoriesNoDescription (info)
    vi.mocked(prisma.user.count).mockResolvedValueOnce(1); // adminsNo2fa (danger)

     
    const res = await GET(new Request('http://localhost/x') as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.length).toBeLessThanOrEqual(5);
    // danger entries first
    expect(json.data[0].severity).toBe('danger');
    expect(cacheSetMock).toHaveBeenCalledTimes(1);
  });

  it('omits empty recommendations', async () => {
    vi.mocked(prisma.product.count).mockResolvedValue(0);
    vi.mocked(prisma.order.count).mockResolvedValue(0);
    vi.mocked(prisma.category.count).mockResolvedValue(0);
    vi.mocked(prisma.user.count).mockResolvedValue(0);

     
    const res = await GET(new Request('http://localhost/x') as any);
    const json = await res.json();
    expect(json.data).toEqual([]);
  });

  it('returns 500 on DB error', async () => {
    vi.mocked(prisma.product.count).mockRejectedValue(new Error('DB down'));
     
    const res = await GET(new Request('http://localhost/x') as any);
    expect(res.status).toBe(500);
  });
});
