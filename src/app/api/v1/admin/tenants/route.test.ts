import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/services/tenant', () => ({
  createTenant: vi.fn(),
  getTenants: vi.fn(),
}));
vi.mock('@/validators/tenant', () => ({
  createTenantSchema: {
    safeParse: vi.fn((data: any) => {
      if (data.name && data.slug) return { success: true, data };
      return { success: false, error: { errors: [{ message: 'Name and slug required' }] } };
    }),
  },
}));

import { GET, POST } from './route';
import { createTenant, getTenants } from '@/services/tenant';
import { NextRequest } from 'next/server';

describe('GET /api/v1/admin/tenants', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns tenants', async () => {
    const tenants = [{ id: 1, name: 'Test' }];
    vi.mocked(getTenants).mockResolvedValue(tenants as any);

    const req = new NextRequest('http://localhost/api/v1/admin/tenants');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual(tenants);
  });

  it('returns 500 on error', async () => {
    vi.mocked(getTenants).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost/api/v1/admin/tenants');
    const res = await GET(req);

    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/admin/tenants', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates a tenant', async () => {
    const tenant = { id: 1, name: 'New', slug: 'new' };
    vi.mocked(createTenant).mockResolvedValue(tenant as any);

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New', slug: 'new' }),
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data).toEqual(tenant);
  });

  it('returns 400 for validation error', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it('returns 409 for unique constraint violation', async () => {
    vi.mocked(createTenant).mockRejectedValue(new Error('Unique constraint failed'));

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Dup', slug: 'dup' }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(409);
  });

  it('returns 500 on generic error', async () => {
    vi.mocked(createTenant).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New', slug: 'new' }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(500);
  });
});
