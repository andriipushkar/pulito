import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/services/warehouse', () => ({
  createWarehouse: vi.fn(),
  getWarehouses: vi.fn(),
  WarehouseError: class WarehouseError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));
vi.mock('@/validators/warehouse', () => ({
  createWarehouseSchema: {
    safeParse: vi.fn((data: any) => {
      if (data.name) return { success: true, data };
      return { success: false, error: { issues: [{ message: 'Name required' }] } };
    }),
  },
}));

import { GET, POST } from './route';
import { createWarehouse, getWarehouses, WarehouseError } from '@/services/warehouse';

describe('GET /api/v1/admin/warehouses', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns warehouses', async () => {
    const warehouses = [{ id: 1, name: 'Main' }];
    vi.mocked(getWarehouses).mockResolvedValue(warehouses as any);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual(warehouses);
  });

  it('returns 500 on error', async () => {
    vi.mocked(getWarehouses).mockRejectedValue(new Error('fail'));

    const res = await GET();

    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/admin/warehouses', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates a warehouse', async () => {
    const warehouse = { id: 1, name: 'New' };
    vi.mocked(createWarehouse).mockResolvedValue(warehouse as any);

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New' }),
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data).toEqual(warehouse);
  });

  it('returns 422 for validation error', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(422);
  });

  it('returns WarehouseError status code', async () => {
    vi.mocked(createWarehouse).mockRejectedValue(new WarehouseError('Conflict', 409));

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Dup' }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(409);
  });

  it('returns 500 on generic error', async () => {
    vi.mocked(createWarehouse).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New' }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(500);
  });
});
