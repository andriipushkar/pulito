import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/order', () => ({
  editOrderItems: vi.fn(),
  OrderError: class OrderError extends Error { statusCode = 400; },
}));

import { PUT } from './route';
import { editOrderItems } from '@/services/order';

const mockCtx = { user: { id: 1 }, params: Promise.resolve({ id: '1' }) };

describe('PUT /api/v1/admin/orders/[id]/items', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('edits order items on success', async () => {
    vi.mocked(editOrderItems).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ items: [{ productId: 1, quantity: 2 }] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(editOrderItems).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ items: [{ productId: 1, quantity: 2 }] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });

  it('returns 400 for non-numeric id', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ items: [{ productId: 1, quantity: 2 }] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, { user: { id: 1 }, params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 on validation failure (empty items)', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ items: [] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns OrderError status on OrderError', async () => {
    const { OrderError } = await import('@/services/order');
    vi.mocked(editOrderItems).mockRejectedValue(new OrderError('order locked'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ items: [{ productId: 1, quantity: 2 }] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });
});
