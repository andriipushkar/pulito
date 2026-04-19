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
vi.mock('@/middleware/auth', () => ({
  withRole:
    (..._roles: string[]) =>
    (handler: any) =>
      handler,
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenantUser: { findFirst: vi.fn() },
  },
}));
vi.mock('@/services/billing', () => ({
  changePlan: vi.fn(),
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

import { POST } from './route';
import { prisma } from '@/lib/prisma';
import { changePlan, BillingError } from '@/services/billing';

describe('POST /api/v1/admin/billing/change-plan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('changes plan successfully', async () => {
    (prisma.tenantUser.findFirst as any).mockResolvedValue({ tenantId: 1 });
    (changePlan as any).mockResolvedValue({ planId: 2, status: 'active' });

    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: 2 }),
    });
    const res = await POST(req, { user: { id: 1 } } as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ planId: 2, status: 'active' });
  });

  it('returns error when planId is missing', async () => {
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req, { user: { id: 1 } } as any);

    expect(res.status).toBe(400);
  });

  it('returns 404 when tenant not found', async () => {
    (prisma.tenantUser.findFirst as any).mockResolvedValue(null);

    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: 2 }),
    });
    const res = await POST(req, { user: { id: 1 } } as any);

    expect(res.status).toBe(404);
  });

  it('returns 500 on error', async () => {
    (prisma.tenantUser.findFirst as any).mockResolvedValue({ tenantId: 1 });
    (changePlan as any).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: 2 }),
    });
    const res = await POST(req, { user: { id: 1 } } as any);

    expect(res.status).toBe(500);
  });
});
