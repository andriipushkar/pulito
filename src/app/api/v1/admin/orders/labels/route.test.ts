import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { findMany: vi.fn() },
  },
}));

import { POST } from './route';
import { prisma } from '@/lib/prisma';

describe('POST /api/v1/admin/orders/labels', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('generates HTML labels for orders', async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([
      {
        orderNumber: 'ORD-001',
        contactName: 'Test',
        contactPhone: '+380991234567',
        deliveryCity: 'Kyiv',
        deliveryAddress: 'St. 1',
        deliveryMethod: 'nova_poshta',
        trackingNumber: 'TN123',
        totalAmount: 500,
        items: [{ product: { name: 'Soap' }, quantity: 1 }],
      },
    ] as any);

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderIds: [1] }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('ORD-001');
    expect(html).toContain('TN123');
  });

  it('returns 400 when orderIds missing', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.order.findMany).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderIds: [1] }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(500);
  });
});
