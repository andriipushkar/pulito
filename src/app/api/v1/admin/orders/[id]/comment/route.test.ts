import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { PUT } from './route';
import { prisma } from '@/lib/prisma';

const mockCtx = { params: Promise.resolve({ id: '1' }) };

describe('PUT /api/v1/admin/orders/[id]/comment', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates comment on success', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(prisma.order.update).mockResolvedValue({ id: 1, managerComment: 'Test' } as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ comment: 'Test comment' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ comment: 'Test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, { params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns 422 on validation error', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ comment: 'x'.repeat(2001) }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(422);
  });

  it('returns 404 when order not found', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ comment: 'Test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(404);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.order.findUnique).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ comment: 'Test comment' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});
