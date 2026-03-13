import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: Function) => (...args: unknown[]) => handler(...args) }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    banner: { findMany: vi.fn(), create: vi.fn(), aggregate: vi.fn() },
  },
}));

import { GET, POST } from './route';
import { prisma } from '@/lib/prisma';

describe('GET /api/v1/admin/banners', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns banners on success', async () => {
    vi.mocked(prisma.banner.findMany).mockResolvedValue([]);
    const res = await (GET as any)();
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.banner.findMany).mockRejectedValue(new Error('fail'));
    const res = await (GET as any)();
    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/admin/banners', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates banner on success', async () => {
    vi.mocked(prisma.banner.aggregate).mockResolvedValue({ _max: { sortOrder: 0 } } as any);
    vi.mocked(prisma.banner.create).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test', imageDesktop: '/img.jpg' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.banner.aggregate).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });

  it('creates banner with empty/missing optional fields', async () => {
    vi.mocked(prisma.banner.aggregate).mockResolvedValue({ _max: { sortOrder: 2 } } as any);
    vi.mocked(prisma.banner.create).mockResolvedValue({ id: 3 } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
  });

  it('creates banner with null maxOrder and optional fields', async () => {
    vi.mocked(prisma.banner.aggregate).mockResolvedValue({ _max: { sortOrder: null } } as any);
    vi.mocked(prisma.banner.create).mockResolvedValue({ id: 2 } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ imageDesktop: '/img.jpg' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
  });
});
