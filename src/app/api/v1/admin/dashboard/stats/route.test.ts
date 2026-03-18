import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetDashboardStats = vi.fn();

vi.mock('@/services/dashboard', () => ({
  getDashboardStats: () => mockGetDashboardStats(),
}));

// Mock auth middleware to bypass auth checks
vi.mock('@/middleware/auth', () => ({
  withRole: () => (handler: Function) => handler,
  withAuth: (handler: Function) => handler,
}));

vi.mock('@/config/env', () => ({
  env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '' },
}));

import { GET } from './route';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/admin/dashboard/stats', () => {
  it('should return dashboard stats', async () => {
    const mockStats = {
      orders: { todayCount: 5, todayRevenue: 10000, yesterdayCount: 3, yesterdayRevenue: 7000, newCount: 2 },
      users: { total: 100, wholesalers: 10, newThisWeek: 5, pendingWholesale: 2 },
      products: { total: 200, outOfStock: 8 },
      topProducts: [{ name: 'Product A', quantity: 50 }],
    };
    mockGetDashboardStats.mockResolvedValue(mockStats);

    const req = new Request('http://localhost/api/v1/admin/dashboard/stats');
    const res = await GET(req as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.orders.todayCount).toBe(5);
    expect(body.data.products.total).toBe(200);
  });

  it('should return 500 on error', async () => {
    mockGetDashboardStats.mockRejectedValue(new Error('DB error'));

    const req = new Request('http://localhost/api/v1/admin/dashboard/stats');
    const res = await GET(req as never);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
  });
});
