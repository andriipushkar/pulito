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
    UPLOAD_DIR: '/tmp/uploads',
  },
}));
vi.mock('@/middleware/auth', () => ({
  withRole: (..._roles: string[]) => (handler: Function) =>
    (req: unknown, ctx?: Record<string, unknown>) =>
      handler(req, { user: { id: 'test-admin', email: 'admin@test.com', role: 'admin' }, ...(ctx || {}) }),
}));
vi.mock('@/services/audit', () => ({ logAudit: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      updateMany: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
  },
}));
vi.mock('exceljs', () => {
  class MockWorksheet {
    columns: unknown;
    addRows = vi.fn();
  }
  class MockWorkbook {
    addWorksheet = vi.fn(() => new MockWorksheet());
    xlsx = { writeBuffer: vi.fn().mockResolvedValue(Buffer.from('test')) };
  }
  return { default: { Workbook: MockWorkbook } };
});
vi.mock('@/services/cache', () => ({ cacheInvalidate: vi.fn() }));
vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  existsSync: vi.fn(() => true),
}));

import { POST } from './route';
import { prisma } from '@/lib/prisma';

describe('POST /api/v1/admin/products/bulk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('activates products', async () => {
    vi.mocked(prisma.product.updateMany).mockResolvedValue({ count: 2 } as any);

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'activate', productIds: [1, 2] }),
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.updated).toBe(2);
  });

  it('deactivates products', async () => {
    vi.mocked(prisma.product.updateMany).mockResolvedValue({ count: 1 } as any);

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deactivate', productIds: [1] }),
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.updated).toBe(1);
  });

  it('returns 400 when no products selected for activate', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'activate', productIds: [] }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it('hard-deletes products when no FK constraints block it', async () => {
    // Route now tries prisma.product.delete first; only falls back to
    // updateMany on Prisma P2003 (FK constraint).
    vi.mocked(prisma.product.delete).mockResolvedValue({} as any);

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', productIds: [1, 2, 3] }),
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.hardDeleted).toBe(3);
    expect(json.data.softDeleted).toBe(0);
    expect(json.data.total).toBe(3);
    expect(prisma.product.delete).toHaveBeenCalledTimes(3);
    expect(prisma.product.updateMany).not.toHaveBeenCalled();
  });

  it('changes category for products', async () => {
    vi.mocked(prisma.product.updateMany).mockResolvedValue({ count: 2 } as any);

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'change_category', productIds: [1, 2], categoryId: 5 }),
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.updated).toBe(2);
    expect(prisma.product.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [1, 2] } },
      data: { categoryId: 5 },
    });
  });

  it('returns 400 when no category specified for change_category', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'change_category', productIds: [1] }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid action', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'invalid' }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it('exports products to xlsx', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      {
        code: 'P1',
        name: 'Product 1',
        priceRetail: 100,
        quantity: 5,
        isActive: true,
        isPromo: false,
        ordersCount: 0,
        category: { name: 'Cat' },
      },
    ] as any);

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'export', productIds: [1] }),
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.url).toContain('/uploads/reports/');
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.product.updateMany).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'activate', productIds: [1] }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(500);
  });
});
