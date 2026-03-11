import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { findMany: vi.fn(), groupBy: vi.fn() },
    orderItem: { groupBy: vi.fn() },
    product: { count: vi.fn() },
    user: { count: vi.fn(), findMany: vi.fn() },
    dailyFunnelStats: { findMany: vi.fn() },
  },
}));

import { GET } from './route';
import { prisma } from '@/lib/prisma';

describe('GET /api/v1/admin/analytics', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns sales analytics on success', async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([]);
    const req = new Request('http://localhost/api/v1/admin/analytics?type=sales&days=7');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.order.findMany).mockRejectedValue(new Error('DB error'));
    const req = new Request('http://localhost/api/v1/admin/analytics?type=sales');
    const res = await GET(req as any);
    expect(res.status).toBe(500);
  });

  it('returns sales analytics with orders grouped by date', async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([
      { createdAt: new Date('2025-01-01'), totalAmount: 100, clientType: 'retail' },
      { createdAt: new Date('2025-01-01'), totalAmount: 200, clientType: 'wholesale' },
    ] as any);
    const req = new Request('http://localhost/api/v1/admin/analytics?type=sales&days=7');
    const res = await GET(req as any);
    const json = await res.json();
    expect(json.data.summary.totalRevenue).toBe(300);
    expect(json.data.summary.totalOrders).toBe(2);
    expect(json.data.summary.avgCheck).toBe(150);
  });

  it('returns products analytics', async () => {
    vi.mocked(prisma.orderItem.groupBy).mockResolvedValue([]);
    vi.mocked(prisma.product.count).mockResolvedValue(5);
    const req = new Request('http://localhost/api/v1/admin/analytics?type=products');
    const res = await GET(req as any);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.zeroSales).toBe(5);
  });

  it('returns clients analytics', async () => {
    vi.mocked(prisma.user.count)
      .mockResolvedValueOnce(10) // newUsers
      .mockResolvedValueOnce(100) // totalUsers
      .mockResolvedValueOnce(5); // wholesalers
    vi.mocked(prisma.order.groupBy).mockResolvedValue([
      { userId: 1, _sum: { totalAmount: 500 }, _count: 3 },
    ] as any);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 1, fullName: 'John', email: 'john@test.com', companyName: null },
    ] as any);
    const req = new Request('http://localhost/api/v1/admin/analytics?type=clients');
    const res = await GET(req as any);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.newUsers).toBe(10);
    expect(json.data.wholesalers).toBe(5);
  });

  it('returns clients analytics with null userId filtered', async () => {
    vi.mocked(prisma.user.count)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    vi.mocked(prisma.order.groupBy).mockResolvedValue([
      { userId: null, _sum: { totalAmount: 100 }, _count: 1 },
    ] as any);
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    const req = new Request('http://localhost/api/v1/admin/analytics?type=clients');
    const res = await GET(req as any);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.topClients[0].client).toBeNull();
  });

  it('returns null client when userId present but not found in map', async () => {
    vi.mocked(prisma.user.count)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    vi.mocked(prisma.order.groupBy).mockResolvedValue([
      { userId: 999, _sum: { totalAmount: 100 }, _count: 1 },
    ] as any);
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    const req = new Request('http://localhost/api/v1/admin/analytics?type=clients');
    const res = await GET(req as any);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.topClients[0].client).toBeNull();
  });

  it('returns orders analytics', async () => {
    vi.mocked(prisma.order.groupBy)
      .mockResolvedValueOnce([{ status: 'new', _count: 5 }] as any) // statusCounts
      .mockResolvedValueOnce([{ deliveryMethod: 'nova_poshta', _count: 3 }] as any) // deliveryCounts
      .mockResolvedValueOnce([{ paymentMethod: 'cash', _count: 2 }] as any); // paymentCounts
    const req = new Request('http://localhost/api/v1/admin/analytics?type=orders');
    const res = await GET(req as any);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.statusCounts).toBeDefined();
  });

  it('returns funnel analytics', async () => {
    vi.mocked(prisma.dailyFunnelStats.findMany).mockResolvedValue([]);
    const req = new Request('http://localhost/api/v1/admin/analytics?type=funnel');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 on unknown type', async () => {
    const req = new Request('http://localhost/api/v1/admin/analytics?type=unknown');
    const res = await GET(req as any);
    expect(res.status).toBe(400);
  });

  it('defaults to sales type when no type specified', async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([]);
    const req = new Request('http://localhost/api/v1/admin/analytics');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.summary).toBeDefined();
  });
});
