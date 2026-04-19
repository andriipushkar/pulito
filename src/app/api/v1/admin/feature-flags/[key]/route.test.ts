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
  updateFlag: vi.fn(),
  deleteFlag: vi.fn(),
}));
vi.mock('@/utils/api-response', () => ({
  successResponse: (data: any, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));

import { PATCH, DELETE } from './route';
import { updateFlag, deleteFlag } from '@/services/feature-flag';

const makeParams = (key: string) => ({ params: Promise.resolve({ key }) });

describe('PATCH /api/v1/admin/feature-flags/[key]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates flag on success', async () => {
    (updateFlag as any).mockResolvedValue({ key: 'dark_mode', isEnabled: true });

    const req = new NextRequest('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEnabled: true }),
    });
    const res = await PATCH(req, makeParams('dark_mode'));

    expect(res.status).toBe(200);
  });

  it('returns 404 when flag not found', async () => {
    (updateFlag as any).mockRejectedValue(new Error('not found'));

    const req = new NextRequest('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEnabled: true }),
    });
    const res = await PATCH(req, makeParams('nonexistent'));

    expect(res.status).toBe(404);
  });

  it('returns 500 on error', async () => {
    (updateFlag as any).mockRejectedValue(new Error('DB error'));

    const req = new NextRequest('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEnabled: true }),
    });
    const res = await PATCH(req, makeParams('dark_mode'));

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/admin/feature-flags/[key]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes flag on success', async () => {
    (deleteFlag as any).mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('dark_mode'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.deleted).toBe(true);
  });

  it('returns 404 when flag not found', async () => {
    (deleteFlag as any).mockRejectedValue(new Error('not found'));

    const req = new NextRequest('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('nonexistent'));

    expect(res.status).toBe(404);
  });

  it('returns 500 on error', async () => {
    (deleteFlag as any).mockRejectedValue(new Error('DB error'));

    const req = new NextRequest('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('dark_mode'));

    expect(res.status).toBe(500);
  });
});
