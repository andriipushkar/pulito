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
  },
}));
vi.mock('@/middleware/auth', () => {
  const withUser = (_req: unknown, ctx?: Record<string, unknown>) => ({
    user: { id: 1, email: 'admin@test.com', role: 'admin' },
    ...(ctx || {}),
  });
  const roleWrap =
    (..._roles: unknown[]) =>
    (handler: Function) =>
    (req: unknown, ctx?: Record<string, unknown>) =>
      handler(req, withUser(req, ctx));
  const authWrap = (handler: Function) => (req: unknown, ctx?: Record<string, unknown>) =>
    handler(req, withUser(req, ctx));
  return {
    withRole: roleWrap,
    withRole2fa: roleWrap,
    withAuth: authWrap,
    withOptionalAuth: authWrap,
  };
});
vi.mock('@/services/tenant', () => ({
  getTenantUsers: vi.fn(),
  addUserToTenant: vi.fn(),
}));
vi.mock('@/validators/tenant', () => ({
  addTenantUserSchema: {
    safeParse: vi.fn((data: any) => {
      if (data.userId) return { success: true, data };
      return { success: false, error: { issues: [{ message: 'userId required' }] } };
    }),
  },
}));

import { GET, POST } from './route';
import { getTenantUsers, addUserToTenant } from '@/services/tenant';

describe('GET /api/v1/admin/tenants/[id]/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns tenant users', async () => {
    const users = [{ id: 1, name: 'User' }];
    vi.mocked(getTenantUsers).mockResolvedValue(users as any);

    const req = new Request('http://localhost');
    const res = await GET(req as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual(users);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost');
    const res = await GET(req as any, { params: Promise.resolve({ id: 'abc' }) });

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(getTenantUsers).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost');
    const res = await GET(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/admin/tenants/[id]/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds user to tenant', async () => {
    const tenantUser = { id: 1, userId: 5, tenantId: 1 };
    vi.mocked(addUserToTenant).mockResolvedValue(tenantUser as any);

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 5 }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data).toEqual(tenantUser);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 5 }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ id: 'abc' }) });

    expect(res.status).toBe(400);
  });

  it('returns 400 for validation error', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(400);
  });

  it('returns 409 for duplicate user', async () => {
    vi.mocked(addUserToTenant).mockRejectedValue(new Error('Unique constraint failed'));

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 5 }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(409);
  });

  it('returns 500 on generic error', async () => {
    vi.mocked(addUserToTenant).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 5 }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(500);
  });
});
