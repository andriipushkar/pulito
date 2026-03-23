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

describe('POST /api/v1/admin/orders/export', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('exports orders as CSV', async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([
      {
        orderNumber: 'ORD-001',
        createdAt: new Date('2024-01-01'),
        contactName: 'Test',
        contactPhone: '+380991234567',
        status: 'completed',
        totalAmount: 1000,
        deliveryMethod: 'nova_poshta',
        items: [{ product: { name: 'Soap' }, quantity: 2 }],
      },
    ] as any);

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderIds: [1] }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/csv');
    expect(res.headers.get('Content-Disposition')).toContain('attachment');
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

  it('returns 400 for empty orderIds array', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderIds: [] }),
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
