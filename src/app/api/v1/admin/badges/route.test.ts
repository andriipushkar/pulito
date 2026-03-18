import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: Function) => (...args: unknown[]) => handler(...args) }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    productBadge: { findMany: vi.fn(), create: vi.fn() },
  },
}));

import { GET, POST } from './route';
import { prisma } from '@/lib/prisma';

describe('GET /api/v1/admin/badges', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns badges on success', async () => {
    vi.mocked(prisma.productBadge.findMany).mockResolvedValue([]);
    const res = await (GET as any)();
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.productBadge.findMany).mockRejectedValue(new Error('fail'));
    const res = await (GET as any)();
    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/admin/badges', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates badge on success', async () => {
    vi.mocked(prisma.productBadge.create).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ productId: 1, badgeType: 'new' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
  });

  it('returns 400 when productId missing', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ badgeType: 'new' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when badgeType missing', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ productId: 1 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.productBadge.create).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ productId: 1, badgeType: 'new' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });
});
