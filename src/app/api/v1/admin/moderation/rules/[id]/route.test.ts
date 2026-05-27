import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
    APP_URL: 'https://test.com',
    CRON_SECRET: 'test-cron-secret',
  },
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    moderationRule: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    moderationLog: { count: vi.fn() },
  },
}));
vi.mock('@/services/audit', () => ({ logAudit: vi.fn() }));
vi.mock('@/utils/request', () => ({ getClientIp: () => null }));

import { GET, PUT, DELETE } from './route';
import { prisma } from '@/lib/prisma';

const ctx = (idStr: string) => ({ params: Promise.resolve({ id: idStr }), user: { id: 1 } }) as any;
const mockCtx = ctx('1');

describe('GET /api/v1/admin/moderation/rules/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns rule on success', async () => {
    vi.mocked(prisma.moderationRule.findUnique).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost');
    const res = await GET(req as any, mockCtx);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID on GET', async () => {
    const req = new Request('http://localhost');
    const res = await GET(req as any, ctx('abc'));
    expect(res.status).toBe(400);
  });

  it('returns 404 when rule not found', async () => {
    vi.mocked(prisma.moderationRule.findUnique).mockResolvedValue(null);
    const req = new Request('http://localhost');
    const res = await GET(req as any, mockCtx);
    expect(res.status).toBe(404);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.moderationRule.findUnique).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost');
    const res = await GET(req as any, mockCtx);
    expect(res.status).toBe(500);
  });
});

describe('PUT /api/v1/admin/moderation/rules/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.moderationRule.findUnique).mockResolvedValue({ id: 1 } as any);
  });

  it('updates rule on success', async () => {
    vi.mocked(prisma.moderationRule.update).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ isActive: false }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx);
    expect(res.status).toBe(200);
  });

  it('returns 404 when rule does not exist', async () => {
    vi.mocked(prisma.moderationRule.findUnique).mockResolvedValue(null);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ isActive: false }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx);
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid ID on PUT', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ isActive: false }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, ctx('abc'));
    expect(res.status).toBe(400);
  });

  it('returns 422 for invalid platform', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ platform: 'invalid' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx);
    expect(res.status).toBe(422);
  });

  it('returns 422 for invalid ruleType', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ ruleType: 'invalid' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx);
    expect(res.status).toBe(422);
  });

  it('returns 422 for invalid action', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ action: 'invalid' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx);
    expect(res.status).toBe(422);
  });
});

describe('DELETE /api/v1/admin/moderation/rules/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.moderationLog.count).mockResolvedValue(0);
    vi.mocked(prisma.moderationRule.findUnique).mockResolvedValue({
      platform: 'telegram',
      ruleType: 'stop_words',
      action: 'delete',
    } as any);
  });

  it('deletes rule on success', async () => {
    vi.mocked(prisma.moderationRule.delete).mockResolvedValue({} as any);
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID on DELETE', async () => {
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, ctx('abc'));
    expect(res.status).toBe(400);
  });

  it('returns 404 when rule does not exist', async () => {
    vi.mocked(prisma.moderationRule.findUnique).mockResolvedValue(null);
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx);
    expect(res.status).toBe(404);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.moderationRule.delete).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx);
    expect(res.status).toBe(500);
  });
});
