import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret', UPLOAD_DIR: '/tmp/uploads' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));
vi.mock('xlsx', () => ({
  utils: {
    book_new: vi.fn(() => ({})),
    json_to_sheet: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  write: vi.fn(() => Buffer.from('test')),
}));
vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  existsSync: vi.fn(() => true),
}));

import { POST } from './route';
import { prisma } from '@/lib/prisma';

describe('POST /api/v1/admin/products/bulk', () => {
  beforeEach(() => { vi.clearAllMocks(); });

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
      { code: 'P1', name: 'Product 1', priceRetail: 100, quantity: 5, isActive: true, isPromo: false, ordersCount: 0, category: { name: 'Cat' } },
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
