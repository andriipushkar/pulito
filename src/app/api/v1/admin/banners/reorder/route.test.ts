import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    banner: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { PUT } from './route';
import { prisma } from '@/lib/prisma';

describe('PUT /api/v1/admin/banners/reorder', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('reorders banners on success', async () => {
    vi.mocked(prisma.$transaction).mockResolvedValue([]);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ orderedIds: [3, 1, 2] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ orderedIds: [3, 1, 2] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(500);
  });

  it('returns 400 when orderedIds is not an array', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ orderedIds: 'not-array' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(400);
  });
});
