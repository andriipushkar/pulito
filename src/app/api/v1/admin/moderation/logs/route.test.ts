import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    moderationLog: { findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
  },
}));

import { GET, PATCH } from './route';
import { prisma } from '@/lib/prisma';

describe('GET /api/v1/admin/moderation/logs', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns moderation logs on success', async () => {
    vi.mocked(prisma.moderationLog.findMany).mockResolvedValue([]);
    vi.mocked(prisma.moderationLog.count).mockResolvedValue(0);
    const req = new Request('http://localhost/api/v1/admin/moderation/logs?page=1&limit=20');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });

  it('filters by platform, ruleId, actionTaken, isFalsePositive', async () => {
    vi.mocked(prisma.moderationLog.findMany).mockResolvedValue([]);
    vi.mocked(prisma.moderationLog.count).mockResolvedValue(0);
    const req = new Request('http://localhost/api/v1/admin/moderation/logs?platform=telegram&ruleId=1&actionTaken=delete&isFalsePositive=true');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.moderationLog.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          platform: 'telegram',
          ruleId: 1,
          actionTaken: 'delete',
          isFalsePositive: true,
        }),
      })
    );
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.moderationLog.findMany).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost/api/v1/admin/moderation/logs');
    const res = await GET(req as any);
    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/v1/admin/moderation/logs', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates log on success', async () => {
    vi.mocked(prisma.moderationLog.update).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ id: 1, isFalsePositive: true }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 when id missing', async () => {
    const req = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ isFalsePositive: true }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req as any);
    expect(res.status).toBe(400);
  });

  it('defaults isFalsePositive to true when not provided', async () => {
    vi.mocked(prisma.moderationLog.update).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ id: 1 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req as any);
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.moderationLog.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isFalsePositive: true },
      })
    );
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.moderationLog.update).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ id: 1, isFalsePositive: true }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req as any);
    expect(res.status).toBe(500);
  });
});
