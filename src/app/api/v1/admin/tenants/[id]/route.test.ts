import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/services/tenant', () => ({
  getTenantById: vi.fn(),
  updateTenant: vi.fn(),
  deleteTenant: vi.fn(),
}));
vi.mock('@/validators/tenant', () => ({
  updateTenantSchema: {
    safeParse: vi.fn((data: any) => {
      if (data.name !== undefined) return { success: true, data };
      return { success: false, error: { errors: [{ message: 'Invalid data' }] } };
    }),
  },
}));

import { GET, PATCH, DELETE } from './route';
import { getTenantById, updateTenant, deleteTenant } from '@/services/tenant';

describe('GET /api/v1/admin/tenants/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns tenant by ID', async () => {
    vi.mocked(getTenantById).mockResolvedValue({ id: 1, name: 'Test' } as any);

    const req = new Request('http://localhost');
    const res = await GET(req as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.name).toBe('Test');
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost');
    const res = await GET(req as any, { params: Promise.resolve({ id: 'abc' }) });

    expect(res.status).toBe(400);
  });

  it('returns 404 when not found', async () => {
    vi.mocked(getTenantById).mockResolvedValue(null as any);

    const req = new Request('http://localhost');
    const res = await GET(req as any, { params: Promise.resolve({ id: '999' }) });

    expect(res.status).toBe(404);
  });

  it('returns 500 on error', async () => {
    vi.mocked(getTenantById).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost');
    const res = await GET(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/v1/admin/tenants/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates a tenant', async () => {
    vi.mocked(updateTenant).mockResolvedValue({ id: 1, name: 'Updated' } as any);

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

  it('returns 409 for unique constraint violation', async () => {
    vi.mocked(updateTenant).mockRejectedValue(new Error('Unique constraint failed'));

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Dup' }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(409);
  });

  it('returns 500 on generic error', async () => {
    vi.mocked(updateTenant).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/admin/tenants/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('deletes a tenant', async () => {
    vi.mocked(deleteTenant).mockResolvedValue(undefined as any);

    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.deleted).toBe(true);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: 'abc' }) });

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(deleteTenant).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(500);
  });
});
