import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/order', () => ({
  getOrderById: vi.fn(),
}));

vi.mock('@/services/cart', () => ({
  addToCart: vi.fn(),
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { POST } from './route';
import { getOrderById } from '@/services/order';
import { addToCart } from '@/services/cart';

const mockGetOrderById = getOrderById as ReturnType<typeof vi.fn>;
const mockAddToCart = addToCart as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ id: '5' }) };

describe('POST /api/v1/orders/[id]/reorder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reorders items from existing order', async () => {
    mockGetOrderById.mockResolvedValue({
      id: 5,
      items: [{ productId: 1, quantity: 2, productName: 'P1' }],
    });
    mockAddToCart.mockResolvedValue(undefined);
    const req = new NextRequest('http://localhost/api/v1/orders/5/reorder', { method: 'POST' });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.addedCount).toBe(1);
  });

  it('returns 404 when order not found', async () => {
    mockGetOrderById.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/v1/orders/5/reorder', { method: 'POST' });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid id', async () => {
    const req = new NextRequest('http://localhost/api/v1/orders/abc/reorder', { method: 'POST' });
    const ctx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ id: 'abc' }) };
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on server error', async () => {
    mockGetOrderById.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/orders/5/reorder', { method: 'POST' });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(500);
  });

  it('handles failed items in reorder', async () => {
    mockGetOrderById.mockResolvedValue({
      id: 5,
      items: [
        { productId: 1, quantity: 2, productName: 'P1' },
        { productId: 2, quantity: 1, productName: 'P2' },
      ],
    });
    mockAddToCart.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('out of stock'));
    const req = new NextRequest('http://localhost/api/v1/orders/5/reorder', { method: 'POST' });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.addedCount).toBe(1);
    expect(json.data.failedItems).toContain('P2');
    expect(json.data.message).toContain('недоступні');
  });

  it('skips items without productId', async () => {
    mockGetOrderById.mockResolvedValue({
      id: 5,
      items: [
        { productId: null, quantity: 1, productName: 'Deleted' },
        { productId: 1, quantity: 1, productName: 'P1' },
      ],
    });
    mockAddToCart.mockResolvedValue(undefined);
    const req = new NextRequest('http://localhost/api/v1/orders/5/reorder', { method: 'POST' });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.addedCount).toBe(1);
  });
});
