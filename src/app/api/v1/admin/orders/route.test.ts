import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/validators/order', () => ({ orderFilterSchema: { safeParse: vi.fn() } }));
vi.mock('@/services/order', () => ({ getAllOrders: vi.fn() }));

import { GET } from './route';
import { getAllOrders } from '@/services/order';
import { orderFilterSchema } from '@/validators/order';

describe('GET /api/v1/admin/orders', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns orders on success', async () => {
    vi.mocked(orderFilterSchema.safeParse).mockReturnValue({ success: true, data: { page: 1, limit: 20 } } as any);
    vi.mocked(getAllOrders).mockResolvedValue({ orders: [], total: 0 });
    const req = new NextRequest('http://localhost/api/v1/admin/orders');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 on filter validation error', async () => {
    vi.mocked(orderFilterSchema.safeParse).mockReturnValue({ success: false, error: { issues: [{ message: 'bad' }] } } as any);
    const req = new NextRequest('http://localhost/api/v1/admin/orders');
    const res = await GET(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(orderFilterSchema.safeParse).mockReturnValue({ success: true, data: { page: 1, limit: 20 } } as any);
    vi.mocked(getAllOrders).mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/admin/orders');
    const res = await GET(req as any);
    expect(res.status).toBe(500);
  });
});
