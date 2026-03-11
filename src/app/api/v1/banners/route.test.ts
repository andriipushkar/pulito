import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    banner: { findMany: vi.fn() },
  },
}));

import { GET } from './route';
import { prisma } from '@/lib/prisma';

const mocked = vi.mocked(prisma.banner.findMany);

describe('GET /api/v1/banners', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns banners on success', async () => {
    mocked.mockResolvedValue([{ id: 1, title: 'Banner' }] as never);
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('returns 500 on error', async () => {
    mocked.mockRejectedValue(new Error('fail'));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
