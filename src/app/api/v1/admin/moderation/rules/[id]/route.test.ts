import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    moderationRule: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));

import { GET, PUT, DELETE } from './route';
import { prisma } from '@/lib/prisma';

const mockCtx = { params: Promise.resolve({ id: '1' }) };

describe('GET /api/v1/admin/moderation/rules/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns rule on success', async () => {
    vi.mocked(prisma.moderationRule.findUnique).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost');
    const res = await GET(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID on GET', async () => {
    const req = new Request('http://localhost');
    const res = await GET(req as any, { params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns 404 when rule not found', async () => {
    vi.mocked(prisma.moderationRule.findUnique).mockResolvedValue(null);
    const req = new Request('http://localhost');
    const res = await GET(req as any, mockCtx as any);
    expect(res.status).toBe(404);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.moderationRule.findUnique).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost');
    const res = await GET(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('PUT /api/v1/admin/moderation/rules/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates rule on success', async () => {
    vi.mocked(prisma.moderationRule.update).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ isActive: false }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('updates rule with all optional fields', async () => {
    vi.mocked(prisma.moderationRule.update).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ platform: 'telegram', ruleType: 'stop_words', config: { words: ['test'] }, action: 'warn', isActive: true }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID on PUT', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ isActive: false }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, { params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid platform', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ platform: 'invalid' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid ruleType', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ ruleType: 'invalid' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid action', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ action: 'invalid' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.moderationRule.update).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ isActive: false }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/admin/moderation/rules/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('deletes rule on success', async () => {
    vi.mocked(prisma.moderationRule.delete).mockResolvedValue({} as any);
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID on DELETE', async () => {
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.moderationRule.delete).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});
