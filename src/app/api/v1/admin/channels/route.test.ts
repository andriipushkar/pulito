import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: Function) => (...args: unknown[]) => handler(...args) }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    channelStats: { findMany: vi.fn() },
    publication: { findMany: vi.fn() },
  },
}));

import { GET } from './route';
import { prisma } from '@/lib/prisma';

describe('GET /api/v1/admin/channels', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns channel stats on success', async () => {
    vi.mocked(prisma.channelStats.findMany).mockResolvedValue([]);
    vi.mocked(prisma.publication.findMany).mockResolvedValue([]);
    const res = await (GET as any)();
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.channelStats.findMany).mockRejectedValue(new Error('fail'));
    const res = await (GET as any)();
    expect(res.status).toBe(500);
  });
});
