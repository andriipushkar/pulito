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
    siteSetting: { findMany: vi.fn(), upsert: vi.fn() },
  },
}));
vi.mock('@/utils/api-response', () => ({
  successResponse: (data: any, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));

import { GET, PUT } from './route';
import { prisma } from '@/lib/prisma';

describe('GET /api/v1/admin/delivery-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns delivery settings on success', async () => {
    (prisma.siteSetting.findMany as any).mockResolvedValue([
      { key: 'delivery_nova_poshta_enabled', value: 'true' },
    ]);

    const res = await (GET as any)();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveProperty('delivery_nova_poshta_enabled');
  });

  it('returns 500 on error', async () => {
    (prisma.siteSetting.findMany as any).mockRejectedValue(new Error('fail'));

    const res = await (GET as any)();

    expect(res.status).toBe(500);
  });
});

describe('PUT /api/v1/admin/delivery-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves settings on success', async () => {
    (prisma.siteSetting.upsert as any).mockResolvedValue({});

    const req = new NextRequest('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delivery_pickup_enabled: 'true' }),
    });
    const res = await PUT(req, { user: { id: 1 } } as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.saved).toBe(true);
  });

  it('returns 500 on error', async () => {
    (prisma.siteSetting.upsert as any).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delivery_pickup_enabled: 'true' }),
    });
    const res = await PUT(req, { user: { id: 1 } } as any);

    expect(res.status).toBe(500);
  });
});
