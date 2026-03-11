import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    siteSetting: { findMany: vi.fn(), upsert: vi.fn() },
  },
}));

import { GET, PUT } from './route';
import { prisma } from '@/lib/prisma';

describe('GET /api/v1/admin/settings', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns settings on success', async () => {
    vi.mocked(prisma.siteSetting.findMany).mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.siteSetting.findMany).mockRejectedValue(new Error('fail'));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe('PUT /api/v1/admin/settings', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates settings on success', async () => {
    vi.mocked(prisma.siteSetting.upsert).mockResolvedValue({} as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ site_name: 'Test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.siteSetting.upsert).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ site_name: 'Test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(500);
  });
});
