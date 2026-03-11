import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/order', () => ({
  getOrderById: vi.fn(),
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { GET } from './route';
import { getOrderById } from '@/services/order';

const mockGetOrderById = getOrderById as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ id: '5' }) };

describe('GET /api/v1/orders/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns order by id', async () => {
    mockGetOrderById.mockResolvedValue({ id: 5, orderNumber: 'ORD-005' });
    const req = new NextRequest('http://localhost/api/v1/orders/5');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.id).toBe(5);
  });

  it('returns 404 when order not found', async () => {
    mockGetOrderById.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/v1/orders/5');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid id', async () => {
    const req = new NextRequest('http://localhost/api/v1/orders/abc');
    const ctx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ id: 'abc' }) };
    const res = await GET(req, ctx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on server error', async () => {
    mockGetOrderById.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/orders/5');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
