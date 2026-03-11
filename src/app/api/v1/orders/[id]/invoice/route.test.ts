import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/pdf', () => {
  class PdfError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return { generateInvoicePdf: vi.fn(), PdfError };
});

vi.mock('@/lib/prisma', () => ({
  prisma: { order: { findUnique: vi.fn() } },
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { POST } from './route';
import { generateInvoicePdf } from '@/services/pdf';
import { prisma } from '@/lib/prisma';

const mockGenerateInvoicePdf = generateInvoicePdf as ReturnType<typeof vi.fn>;
const mockFindUnique = prisma.order.findUnique as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ id: '5' }) };

describe('POST /api/v1/orders/[id]/invoice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('generates invoice PDF', async () => {
    mockFindUnique.mockResolvedValue({ id: 5, userId: 1 });
    mockGenerateInvoicePdf.mockResolvedValue('https://example.com/invoice.pdf');
    const req = new NextRequest('http://localhost/api/v1/orders/5/invoice', { method: 'POST' });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.url).toBe('https://example.com/invoice.pdf');
  });

  it('returns 404 when order not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/v1/orders/5/invoice', { method: 'POST' });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid id', async () => {
    const req = new NextRequest('http://localhost/api/v1/orders/abc/invoice', { method: 'POST' });
    const ctx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ id: 'abc' }) };
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on server error', async () => {
    mockFindUnique.mockResolvedValue({ id: 5, userId: 1 });
    mockGenerateInvoicePdf.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/orders/5/invoice', { method: 'POST' });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(500);
  });

  it('returns 404 when order belongs to different user', async () => {
    mockFindUnique.mockResolvedValue({ id: 5, userId: 999 });
    const req = new NextRequest('http://localhost/api/v1/orders/5/invoice', { method: 'POST' });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(404);
  });

  it('handles PdfError with custom status', async () => {
    const { PdfError } = await import('@/services/pdf');
    mockFindUnique.mockResolvedValue({ id: 5, userId: 1 });
    mockGenerateInvoicePdf.mockRejectedValue(new PdfError('PDF generation failed', 503));
    const req = new NextRequest('http://localhost/api/v1/orders/5/invoice', { method: 'POST' });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(503);
  });
});
