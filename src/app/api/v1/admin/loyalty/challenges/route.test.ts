import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    loyaltyChallenge: { findMany: vi.fn(), create: vi.fn() },
  },
}));
vi.mock('@/utils/api-response', () => ({
  successResponse: (data: any, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));

import { GET, POST } from './route';
import { prisma } from '@/lib/prisma';

describe('GET /api/v1/admin/loyalty/challenges', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns challenges on success', async () => {
    (prisma.loyaltyChallenge.findMany as any).mockResolvedValue([
      { id: 1, name: 'Challenge', _count: { progress: 5 } },
    ]);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data[0].participantsCount).toBe(5);
  });

  it('returns 500 on error', async () => {
    (prisma.loyaltyChallenge.findMany as any).mockRejectedValue(new Error('fail'));

    const res = await GET();

    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/admin/loyalty/challenges', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates challenge on success', async () => {
    (prisma.loyaltyChallenge.create as any).mockResolvedValue({ id: 1, name: 'New Challenge' });

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New Challenge',
        description: 'Desc',
        type: 'order_count',
        target: 5,
        reward: 100,
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
  });

  it('returns 400 on validation error', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    (prisma.loyaltyChallenge.create as any).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New',
        description: 'D',
        type: 'order_count',
        target: 5,
        reward: 100,
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
  });
});
