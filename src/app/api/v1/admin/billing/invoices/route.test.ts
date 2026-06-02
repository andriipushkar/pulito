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
    tenantBilling: { findUnique: vi.fn() },
    billingInvoice: { findMany: vi.fn(), count: vi.fn().mockResolvedValue(1) },
  },
}));
vi.mock('@/lib/admin-tenant', () => ({ resolveActiveTenantId: vi.fn() }));
vi.mock('@/utils/api-response', () => ({
  successResponse: (data: any, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));

import { GET } from './route';
import { prisma } from '@/lib/prisma';
import { resolveActiveTenantId } from '@/lib/admin-tenant';

const notFound = () => ({
  error: Response.json({ error: 'Тенант не знайдено' }, { status: 404 }),
});

describe('GET /api/v1/admin/billing/invoices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns invoices on success', async () => {
    (resolveActiveTenantId as any).mockResolvedValue({ tenantId: 1 });
    (prisma.tenantBilling.findUnique as any).mockResolvedValue({ id: 10, tenantId: 1 });
    (prisma.billingInvoice.findMany as any).mockResolvedValue([{ id: 1, amount: 100 }]);

    const req = new NextRequest('http://localhost');
    const res = await GET(req, { user: { id: 1 } } as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.invoices).toEqual([{ id: 1, amount: 100 }]);
    expect(data.total).toBe(1);
  });

  it('returns 404 when tenant not found', async () => {
    (resolveActiveTenantId as any).mockResolvedValue(notFound());

    const req = new NextRequest('http://localhost');
    const res = await GET(req, { user: { id: 1 } } as any);

    expect(res.status).toBe(404);
  });

  it('returns 404 when billing not found', async () => {
    (resolveActiveTenantId as any).mockResolvedValue({ tenantId: 1 });
    (prisma.tenantBilling.findUnique as any).mockResolvedValue(null);

    const req = new NextRequest('http://localhost');
    const res = await GET(req, { user: { id: 1 } } as any);

    expect(res.status).toBe(404);
  });

  it('returns 500 on error', async () => {
    (resolveActiveTenantId as any).mockResolvedValue({ tenantId: 1 });
    (prisma.tenantBilling.findUnique as any).mockRejectedValue(new Error('DB error'));

    const req = new NextRequest('http://localhost');
    const res = await GET(req, { user: { id: 1 } } as any);

    expect(res.status).toBe(500);
  });
});
