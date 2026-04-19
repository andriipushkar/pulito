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
vi.mock('@/services/feature-flag', () => ({
  getAllFlags: vi.fn(),
  createFlag: vi.fn(),
}));
vi.mock('@/utils/api-response', () => ({
  successResponse: (data: any, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));

import { GET, POST } from './route';
import { getAllFlags, createFlag } from '@/services/feature-flag';

describe('GET /api/v1/admin/feature-flags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns flags on success', async () => {
    (getAllFlags as any).mockResolvedValue([{ key: 'dark_mode', isEnabled: true }]);

    const res = await (GET as any)();

    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    (getAllFlags as any).mockRejectedValue(new Error('fail'));

    const res = await (GET as any)();

    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/admin/feature-flags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates flag on success', async () => {
    (createFlag as any).mockResolvedValue({ key: 'new_feature', isEnabled: false });

    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'new_feature' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
  });

  it('returns 400 when key is missing', async () => {
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid key format', async () => {
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'Invalid Key!' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('returns 409 on duplicate key', async () => {
    (createFlag as any).mockRejectedValue(new Error('Unique constraint'));

    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'existing' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(409);
  });

  it('returns 500 on error', async () => {
    (createFlag as any).mockRejectedValue(new Error('DB error'));

    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'test' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
  });
});
