import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret', UPLOAD_DIR: '/tmp/uploads-test' } }));
vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  existsSync: vi.fn(() => true),
}));
vi.mock('@/middleware/auth', () => ({
  withRole: (..._roles: string[]) => (handler: Function) =>
    (req: unknown, ctx?: Record<string, unknown>) =>
      handler(req, { user: { id: 'test-admin', email: 'admin@test.com', role: 'admin' }, ...(ctx || {}) }),
}));
vi.mock('@/services/audit', () => ({ logAudit: vi.fn() }));
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
    const json = await res.json();

    expect(res.status).toBe(200);
    // The handler persists HTML to disk and returns the saved file's URL.
    expect(json.data.url).toMatch(/^\/uploads\/reports\/labels_\d+\.html$/);
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
