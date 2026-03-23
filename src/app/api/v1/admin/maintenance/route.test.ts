import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    siteSetting: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));
vi.mock('@/services/cache', () => ({
  cacheInvalidate: vi.fn(),
}));
vi.mock('@/utils/api-response', () => ({
  successResponse: (data: any, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));

import { GET, PUT } from './route';
import { prisma } from '@/lib/prisma';

describe('GET /api/v1/admin/maintenance', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns maintenance status on success', async () => {
    (prisma.siteSetting.findUnique as any)
      .mockResolvedValueOnce({ value: 'true' })
      .mockResolvedValueOnce({ value: 'We are updating' });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.enabled).toBe(true);
    expect(data.message).toBe('We are updating');
  });

  it('returns 500 on error', async () => {
    (prisma.siteSetting.findUnique as any).mockRejectedValue(new Error('fail'));

    const res = await GET();

    expect(res.status).toBe(500);
  });
});

describe('PUT /api/v1/admin/maintenance', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates maintenance mode on success', async () => {
    (prisma.siteSetting.upsert as any).mockResolvedValue({});

    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, message: 'Maintenance' }),
    });
    const res = await PUT(req, { user: { id: 1 } });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.enabled).toBe(true);
  });

  it('returns 500 on error', async () => {
    (prisma.siteSetting.upsert as any).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    const res = await PUT(req, { user: { id: 1 } });

    expect(res.status).toBe(500);
  });
});
