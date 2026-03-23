import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/services/warehouse', () => ({
  getWarehouseById: vi.fn(),
  updateWarehouse: vi.fn(),
  deleteWarehouse: vi.fn(),
  WarehouseError: class WarehouseError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));
vi.mock('@/validators/warehouse', () => ({
  updateWarehouseSchema: {
    safeParse: vi.fn((data: any) => {
      if (Object.keys(data).length > 0) return { success: true, data };
      return { success: false, error: { issues: [{ message: 'Invalid data' }] } };
    }),
  },
}));

import { GET, PATCH, DELETE } from './route';
import { getWarehouseById, updateWarehouse, deleteWarehouse, WarehouseError } from '@/services/warehouse';

describe('GET /api/v1/admin/warehouses/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns warehouse by ID', async () => {
    vi.mocked(getWarehouseById).mockResolvedValue({ id: 1, name: 'Main' } as any);

    const req = new Request('http://localhost');
    const res = await GET(req as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.name).toBe('Main');
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

describe('PATCH /api/v1/admin/warehouses/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates a warehouse', async () => {
    vi.mocked(updateWarehouse).mockResolvedValue({ id: 1, name: 'Updated' } as any);

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.name).toBe('Updated');
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: 'abc' }) });

    expect(res.status).toBe(400);
  });

  it('returns WarehouseError status code', async () => {
    vi.mocked(updateWarehouse).mockRejectedValue(new WarehouseError('Conflict', 409));

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(409);
  });

  it('returns 500 on generic error', async () => {
    vi.mocked(updateWarehouse).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/admin/warehouses/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('deletes a warehouse', async () => {
    vi.mocked(deleteWarehouse).mockResolvedValue(undefined as any);

    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.message).toContain('видалено');
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: 'abc' }) });

    expect(res.status).toBe(400);
  });

  it('returns WarehouseError status code', async () => {
    vi.mocked(deleteWarehouse).mockRejectedValue(new WarehouseError('Has stock', 409));

    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(409);
  });

  it('returns 500 on generic error', async () => {
    vi.mocked(deleteWarehouse).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(500);
  });
});
