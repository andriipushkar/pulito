import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    moderationRule: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  },
}));

import { GET, POST } from './route';
import { prisma } from '@/lib/prisma';

describe('GET /api/v1/admin/moderation/rules', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns rules on success', async () => {
    vi.mocked(prisma.moderationRule.findMany).mockResolvedValue([]);
    vi.mocked(prisma.moderationRule.count).mockResolvedValue(0);
    const req = new Request('http://localhost/api/v1/admin/moderation/rules?page=1&limit=20');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.moderationRule.findMany).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost/api/v1/admin/moderation/rules');
    const res = await GET(req as any);
    expect(res.status).toBe(500);
  });

  it('filters by platform and ruleType params', async () => {
    vi.mocked(prisma.moderationRule.findMany).mockResolvedValue([]);
    vi.mocked(prisma.moderationRule.count).mockResolvedValue(0);
    const req = new Request('http://localhost/api/v1/admin/moderation/rules?platform=telegram&ruleType=stop_words');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.moderationRule.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ platform: 'telegram', ruleType: 'stop_words' }),
      })
    );
  });

  it('filters by isActive=true param', async () => {
    vi.mocked(prisma.moderationRule.findMany).mockResolvedValue([]);
    vi.mocked(prisma.moderationRule.count).mockResolvedValue(0);
    const req = new Request('http://localhost/api/v1/admin/moderation/rules?isActive=true');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.moderationRule.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    );
  });

  it('filters by isActive=false param', async () => {
    vi.mocked(prisma.moderationRule.findMany).mockResolvedValue([]);
    vi.mocked(prisma.moderationRule.count).mockResolvedValue(0);
    const req = new Request('http://localhost/api/v1/admin/moderation/rules?isActive=false');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.moderationRule.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: false }),
      })
    );
  });

  it('uses custom valid sortBy field', async () => {
    vi.mocked(prisma.moderationRule.findMany).mockResolvedValue([]);
    vi.mocked(prisma.moderationRule.count).mockResolvedValue(0);
    const req = new Request('http://localhost/api/v1/admin/moderation/rules?sortBy=platform');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.moderationRule.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { platform: 'desc' },
      })
    );
  });

  it('falls back to createdAt for invalid sortBy field', async () => {
    vi.mocked(prisma.moderationRule.findMany).mockResolvedValue([]);
    vi.mocked(prisma.moderationRule.count).mockResolvedValue(0);
    const req = new Request('http://localhost/api/v1/admin/moderation/rules?sortBy=invalid_field');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.moderationRule.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      })
    );
  });
});

describe('POST /api/v1/admin/moderation/rules', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates rule on success', async () => {
    vi.mocked(prisma.moderationRule.create).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ platform: 'telegram', ruleType: 'stop_words', action: 'delete', config: { words: ['spam'] } }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.moderationRule.create).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ platform: 'telegram', ruleType: 'stop_words', action: 'delete', config: { words: [] } }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });

  it('returns 400 for invalid platform', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ platform: 'invalid', ruleType: 'stop_words', action: 'delete', config: { words: [] } }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid ruleType', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ platform: 'telegram', ruleType: 'invalid', action: 'delete', config: { words: [] } }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid action', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ platform: 'telegram', ruleType: 'stop_words', action: 'invalid', config: { words: [] } }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing config', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ platform: 'telegram', ruleType: 'stop_words', action: 'delete' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });
});
