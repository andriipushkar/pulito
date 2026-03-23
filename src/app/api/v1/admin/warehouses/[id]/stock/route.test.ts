import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/services/warehouse', () => ({
  getWarehouseById: vi.fn(),
  updateStock: vi.fn(),
  WarehouseError: class WarehouseError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));
vi.mock('@/validators/warehouse', () => ({
  updateStockSchema: {
    safeParse: vi.fn((data: any) => {
      if (data.items && Array.isArray(data.items)) return { success: true, data };
      return { success: false, error: { issues: [{ message: 'Items required' }] } };
    }),
  },
}));

import { GET, PUT } from './route';
import { getWarehouseById, updateStock, WarehouseError } from '@/services/warehouse';

describe('GET /api/v1/admin/warehouses/[id]/stock', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns warehouse stock', async () => {
    const stock = [{ productId: 1, quantity: 10 }];
    vi.mocked(getWarehouseById).mockResolvedValue({ id: 1, stock } as any);

    const req = new Request('http://localhost');
    const res = await GET(req as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual(stock);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost');
    const res = await GET(req as any, { params: Promise.resolve({ id: 'abc' }) });

    expect(res.status).toBe(400);
  });

  it('returns WarehouseError status code', async () => {
    vi.mocked(getWarehouseById).mockRejectedValue(new WarehouseError('Not found', 404));

    const req = new Request('http://localhost');
    const res = await GET(req as any, { params: Promise.resolve({ id: '999' }) });

    expect(res.status).toBe(404);
  });

  it('returns 500 on generic error', async () => {
    vi.mocked(getWarehouseById).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost');
    const res = await GET(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(500);
  });
});

describe('PUT /api/v1/admin/warehouses/[id]/stock', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates stock', async () => {
    const results = [{ productId: 1, quantity: 20 }];
    vi.mocked(updateStock).mockResolvedValue(results as any);

    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 1, quantity: 20 }] }),
    });
    const res = await PUT(req as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual(results);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [] }),
    });
    const res = await PUT(req as any, { params: Promise.resolve({ id: 'abc' }) });

    expect(res.status).toBe(400);
  });

  it('returns 422 for validation error', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await PUT(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(422);
  });

  it('returns WarehouseError status code', async () => {
    vi.mocked(updateStock).mockRejectedValue(new WarehouseError('Not found', 404));

    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 1, quantity: 20 }] }),
    });
    const res = await PUT(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(404);
  });

  it('returns 500 on generic error', async () => {
    vi.mocked(updateStock).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 1, quantity: 20 }] }),
    });
    const res = await PUT(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(500);
  });
});
