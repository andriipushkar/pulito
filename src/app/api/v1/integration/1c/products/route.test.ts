import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
    APP_URL: 'https://test.com',
    CRON_SECRET: 'test-cron-secret',
    APP_SECRET: 'test-app-secret',
  },
}));
vi.mock('@/middleware/api-key-auth', () => ({
  withApiKey:
    (..._scopes: string[][]) =>
    (handler: any) =>
      handler,
}));
vi.mock('@/services/integration-1c', () => ({
  importProductsFrom1C: vi.fn(),
  exportOrdersTo1C: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findMany: vi.fn(), count: vi.fn() },
    integrationSync: { create: vi.fn(), update: vi.fn() },
  },
}));
vi.mock('@/validators/integration-1c', () => ({
  oneCProductsImportSchema: { safeParse: vi.fn() },
}));

import { GET, POST } from './route';
import { importProductsFrom1C } from '@/services/integration-1c';
import { prisma } from '@/lib/prisma';
import { oneCProductsImportSchema } from '@/validators/integration-1c';

describe('GET /api/v1/integration/1c/products', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports products with pagination', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      {
        code: 'P1',
        name: 'Test',
        priceRetail: 100,
        priceWholesale: null,
        quantity: 10,
        category: { name: 'Cat1' },
      },
    ] as any);
    vi.mocked(prisma.product.count).mockResolvedValue(1);
    const req = new NextRequest('http://localhost/api/v1/integration/1c/products?page=1&limit=50');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.total).toBe(1);
    expect(data.data.items[0].code).toBe('P1');
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.product.findMany).mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/integration/1c/products');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/integration/1c/products', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 422 on invalid body', async () => {
    vi.mocked(oneCProductsImportSchema.safeParse).mockReturnValue({
      success: false,
      error: { issues: [{ message: 'Invalid' }] },
    } as any);
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it('imports products successfully', async () => {
    vi.mocked(oneCProductsImportSchema.safeParse).mockReturnValue({
      success: true,
      data: { products: [{ code: 'P1', name: 'Test', price: 100 }] },
    } as any);
    vi.mocked(prisma.integrationSync.create).mockResolvedValue({ id: 1 } as any);
    vi.mocked(importProductsFrom1C).mockResolvedValue({
      total: 1,
      processed: 1,
      created: 1,
      updated: 0,
      failed: 0,
      errors: [],
    });
    vi.mocked(prisma.integrationSync.update).mockResolvedValue({} as any);
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: [{ code: 'P1', name: 'Test', price: 100 }] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.processed).toBe(1);
  });

  it('returns 500 on error', async () => {
    vi.mocked(oneCProductsImportSchema.safeParse).mockImplementation(() => {
      throw new Error('fail');
    });
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
