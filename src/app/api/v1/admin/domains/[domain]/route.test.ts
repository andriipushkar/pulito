import { NextRequest } from 'next/server';
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
vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenantUser: { findFirst: vi.fn() },
    tenant: {
      findUnique: vi.fn().mockResolvedValue({ domain: 'example.com', domainVerified: true }),
    },
  },
}));
vi.mock('@/lib/admin-tenant', () => ({ resolveActiveTenantId: vi.fn() }));
vi.mock('@/services/audit', () => ({ logAudit: vi.fn() }));
vi.mock('@/services/domain', () => ({
  removeDomain: vi.fn(),
}));
vi.mock('@/utils/api-response', () => ({
  successResponse: (data: any, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));

import { DELETE } from './route';
import { prisma } from '@/lib/prisma';
import { removeDomain } from '@/services/domain';
import { resolveActiveTenantId } from '@/lib/admin-tenant';

const notFound = () => ({
  error: Response.json({ error: 'Тенант не знайдено' }, { status: 404 }),
});

describe('DELETE /api/v1/admin/domains/[domain]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes domain on success', async () => {
    (resolveActiveTenantId as any).mockResolvedValue({ tenantId: 1 });
    (removeDomain as any).mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req, { user: { id: 1 } } as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.removed).toBe(true);
  });

  it('returns 404 when tenant not found', async () => {
    (resolveActiveTenantId as any).mockResolvedValue(notFound());

    const req = new NextRequest('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req, { user: { id: 1 } } as any);

    expect(res.status).toBe(404);
  });

  it('returns 500 on error', async () => {
    (resolveActiveTenantId as any).mockResolvedValue({ tenantId: 1 });
    (removeDomain as any).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req, { user: { id: 1 } } as any);

    expect(res.status).toBe(500);
  });
});
