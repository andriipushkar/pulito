import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/order', () => {
  class OrderError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return { updateOrderStatus: vi.fn(), OrderError };
});

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { PUT } from './route';
import { updateOrderStatus } from '@/services/order';

const mockUpdateOrderStatus = updateOrderStatus as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ id: '5' }) };

describe('PUT /api/v1/orders/[id]/status', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cancels order successfully', async () => {
    mockUpdateOrderStatus.mockResolvedValue({ id: 5, status: 'cancelled' });
    const req = new NextRequest('http://localhost/api/v1/orders/5/status', {
      method: 'PUT',
      body: JSON.stringify({ status: 'cancelled' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 403 for non-cancel status', async () => {
    const req = new NextRequest('http://localhost/api/v1/orders/5/status', {
      method: 'PUT',
      body: JSON.stringify({ status: 'processing' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req, authCtx as any);
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid id', async () => {
    const req = new NextRequest('http://localhost/api/v1/orders/abc/status', {
      method: 'PUT',
      body: JSON.stringify({ status: 'cancelled' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const ctx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ id: 'abc' }) };
    const res = await PUT(req, ctx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on server error', async () => {
    mockUpdateOrderStatus.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/orders/5/status', {
      method: 'PUT',
      body: JSON.stringify({ status: 'cancelled' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req, authCtx as any);
    expect(res.status).toBe(500);
  });

  it('handles OrderError with custom status code', async () => {
    const { OrderError } = await import('@/services/order');
    mockUpdateOrderStatus.mockRejectedValue(new OrderError('Cannot cancel delivered order', 409));
    const req = new NextRequest('http://localhost/api/v1/orders/5/status', {
      method: 'PUT',
      body: JSON.stringify({ status: 'cancelled' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req, authCtx as any);
    expect(res.status).toBe(409);
  });
});
