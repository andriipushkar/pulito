import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    productBadge: { update: vi.fn(), delete: vi.fn() },
  },
}));

import { PUT, DELETE } from './route';
import { prisma } from '@/lib/prisma';

const mockCtx = { params: Promise.resolve({ id: '1' }) };

describe('PUT /api/v1/admin/badges/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates badge on success', async () => {
    vi.mocked(prisma.productBadge.update).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ isActive: false }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.productBadge.update).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ isActive: false }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/admin/badges/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('deletes badge on success', async () => {
    vi.mocked(prisma.productBadge.delete).mockResolvedValue({} as any);
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.productBadge.delete).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });

  it('returns 400 for non-numeric id', async () => {
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/v1/admin/badges/[id] - invalid id', () => {
  it('returns 400 for non-numeric id', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ isActive: false }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, { params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });
});
