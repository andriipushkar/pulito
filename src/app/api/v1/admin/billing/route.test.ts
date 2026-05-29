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
  },
}));
vi.mock('@/services/billing', () => ({
  getBilling: vi.fn(),
  checkUsageLimits: vi.fn(),
  BillingError: class BillingError extends Error {
    statusCode: number;
    constructor(msg: string, code: number) {
      super(msg);
      this.statusCode = code;
    }
  },
}));
vi.mock('@/utils/api-response', () => ({
  successResponse: (data: any, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));

import { GET } from './route';
import { prisma } from '@/lib/prisma';
import { getBilling, checkUsageLimits } from '@/services/billing';

describe('GET /api/v1/admin/billing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns billing and usage on success', async () => {
    (prisma.tenantUser.findFirst as any).mockResolvedValue({ tenantId: 1 });
    (getBilling as any).mockResolvedValue({ plan: 'pro' });
    (checkUsageLimits as any).mockResolvedValue({ products: 50 });

    const req = new NextRequest('http://localhost');
    const res = await GET(req, { user: { id: 1 } } as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ billing: { plan: 'pro' }, usage: { products: 50 } });
  });

  it('returns 404 when tenant not found', async () => {
    (prisma.tenantUser.findFirst as any).mockResolvedValue(null);

    const req = new NextRequest('http://localhost');
    const res = await GET(req, { user: { id: 1 } } as any);

    expect(res.status).toBe(404);
  });

  it('returns 500 on error', async () => {
    (prisma.tenantUser.findFirst as any).mockResolvedValue({ tenantId: 1 });
    (getBilling as any).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost');
    const res = await GET(req, { user: { id: 1 } } as any);

    expect(res.status).toBe(500);
  });
});
