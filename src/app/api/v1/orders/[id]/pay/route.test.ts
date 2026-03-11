import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/payment', () => {
  class PaymentError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return { initiatePayment: vi.fn(), PaymentError };
});

vi.mock('@/validators/payment', () => ({
  initiatePaymentSchema: { safeParse: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { order: { findUnique: vi.fn() } },
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { POST } from './route';
import { initiatePayment } from '@/services/payment';
import { initiatePaymentSchema } from '@/validators/payment';
import { prisma } from '@/lib/prisma';

const mockInitiatePayment = initiatePayment as ReturnType<typeof vi.fn>;
const mockSafeParse = initiatePaymentSchema.safeParse as ReturnType<typeof vi.fn>;
const mockFindUnique = prisma.order.findUnique as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ id: '5' }) };

describe('POST /api/v1/orders/[id]/pay', () => {
  beforeEach(() => vi.clearAllMocks());

  it('initiates payment successfully', async () => {
    mockFindUnique.mockResolvedValue({ userId: 1 });
    mockSafeParse.mockReturnValue({ success: true, data: { provider: 'monobank' } });
    mockInitiatePayment.mockResolvedValue({ paymentUrl: 'https://pay.me' });
    const req = new NextRequest('http://localhost/api/v1/orders/5/pay', {
      method: 'POST',
      body: JSON.stringify({ provider: 'monobank' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 404 when order not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/v1/orders/5/pay', {
      method: 'POST',
      body: JSON.stringify({ provider: 'monobank' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid id', async () => {
    const req = new NextRequest('http://localhost/api/v1/orders/abc/pay', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const ctx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ id: 'abc' }) };
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on server error', async () => {
    mockFindUnique.mockResolvedValue({ userId: 1 });
    mockSafeParse.mockReturnValue({ success: true, data: { provider: 'monobank' } });
    mockInitiatePayment.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/orders/5/pay', {
      method: 'POST',
      body: JSON.stringify({ provider: 'monobank' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(500);
  });

  it('returns 400 on validation error', async () => {
    mockFindUnique.mockResolvedValue({ userId: 1 });
    mockSafeParse.mockReturnValue({ success: false, error: { issues: [{ message: 'Invalid provider' }] } });
    const req = new NextRequest('http://localhost/api/v1/orders/5/pay', {
      method: 'POST',
      body: JSON.stringify({ provider: 'invalid' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 404 when order belongs to different user', async () => {
    mockFindUnique.mockResolvedValue({ userId: 999 });
    const req = new NextRequest('http://localhost/api/v1/orders/5/pay', {
      method: 'POST',
      body: JSON.stringify({ provider: 'monobank' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(404);
  });

  it('handles PaymentError with custom status', async () => {
    const { PaymentError } = await import('@/services/payment');
    mockFindUnique.mockResolvedValue({ userId: 1 });
    mockSafeParse.mockReturnValue({ success: true, data: { provider: 'monobank' } });
    mockInitiatePayment.mockRejectedValue(new PaymentError('Payment declined', 402));
    const req = new NextRequest('http://localhost/api/v1/orders/5/pay', {
      method: 'POST',
      body: JSON.stringify({ provider: 'monobank' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(402);
  });
});
