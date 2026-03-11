import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/qr-code', () => {
  class QRCodeError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return { generateOrderQR: vi.fn(), QRCodeError };
});

vi.mock('@/lib/prisma', () => ({
  prisma: { order: { findFirst: vi.fn() } },
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { GET } from './route';
import { generateOrderQR } from '@/services/qr-code';
import { prisma } from '@/lib/prisma';

const mockGenerateOrderQR = generateOrderQR as ReturnType<typeof vi.fn>;
const mockFindFirst = prisma.order.findFirst as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ id: '5' }) };

describe('GET /api/v1/orders/[id]/qr', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns QR code as PNG', async () => {
    mockFindFirst.mockResolvedValue({ orderNumber: 'ORD-005' });
    mockGenerateOrderQR.mockResolvedValue(Buffer.from('png-data'));
    const req = new NextRequest('http://localhost/api/v1/orders/5/qr');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
  });

  it('returns 404 when order not found', async () => {
    mockFindFirst.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/v1/orders/5/qr');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid id', async () => {
    const req = new NextRequest('http://localhost/api/v1/orders/abc/qr');
    const ctx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ id: 'abc' }) };
    const res = await GET(req, ctx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on server error', async () => {
    mockFindFirst.mockResolvedValue({ orderNumber: 'ORD-005' });
    mockGenerateOrderQR.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/orders/5/qr');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(500);
  });

  it('handles QRCodeError with custom status', async () => {
    const { QRCodeError } = await import('@/services/qr-code');
    mockFindFirst.mockResolvedValue({ orderNumber: 'ORD-005' });
    mockGenerateOrderQR.mockRejectedValue(new QRCodeError('QR generation failed', 503));
    const req = new NextRequest('http://localhost/api/v1/orders/5/qr');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(503);
  });

  it('client user can only see own orders', async () => {
    const clientCtx = { user: { id: 2, email: 'client@test.com', role: 'client' }, params: Promise.resolve({ id: '5' }) };
    mockFindFirst.mockResolvedValue({ orderNumber: 'ORD-005' });
    mockGenerateOrderQR.mockResolvedValue(Buffer.from('png'));
    const req = new NextRequest('http://localhost/api/v1/orders/5/qr');
    const res = await GET(req, clientCtx as any);
    expect(res.status).toBe(200);
    // Verify the query includes userId filter for non-admin
    expect(mockFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 2 }),
    }));
  });
});
