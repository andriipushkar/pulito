import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    analyticsAlert: { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));

import { PUT, DELETE } from './route';
import { prisma } from '@/lib/prisma';

const mockCtx = { user: { id: 1 }, params: Promise.resolve({ id: '1' }) };

describe('PUT /api/v1/admin/analytics/alerts/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates alert on success', async () => {
    vi.mocked(prisma.analyticsAlert.findFirst).mockResolvedValue({ id: 1, isActive: true } as any);
    vi.mocked(prisma.analyticsAlert.update).mockResolvedValue({ id: 1, isActive: false } as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ isActive: false }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.analyticsAlert.findFirst).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ isActive: false }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });

  it('returns 404 when alert not found', async () => {
    vi.mocked(prisma.analyticsAlert.findFirst).mockResolvedValue(null);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ isActive: false }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid id', async () => {
    const invalidCtx = { user: { id: 1 }, params: Promise.resolve({ id: 'abc' }) };
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ isActive: false }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, invalidCtx as any);
    expect(res.status).toBe(400);
  });

  it('uses existing isActive when not provided in body', async () => {
    vi.mocked(prisma.analyticsAlert.findFirst).mockResolvedValue({ id: 1, isActive: true } as any);
    vi.mocked(prisma.analyticsAlert.update).mockResolvedValue({ id: 1, isActive: true } as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/v1/admin/analytics/alerts/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('deletes alert on success', async () => {
    vi.mocked(prisma.analyticsAlert.findFirst).mockResolvedValue({ id: 1 } as any);
    vi.mocked(prisma.analyticsAlert.delete).mockResolvedValue({} as any);
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.analyticsAlert.findFirst).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });

  it('returns 404 when alert not found', async () => {
    vi.mocked(prisma.analyticsAlert.findFirst).mockResolvedValue(null);
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid id', async () => {
    const invalidCtx = { user: { id: 1 }, params: Promise.resolve({ id: 'abc' }) };
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, invalidCtx as any);
    expect(res.status).toBe(400);
  });
});
