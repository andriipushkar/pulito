import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/pdf', () => ({
  generateCommercialOfferPdf: vi.fn(),
  PdfError: class PdfError extends Error { statusCode = 400; },
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findMany: vi.fn() },
  },
}));

import { POST } from './route';
import { prisma } from '@/lib/prisma';
import { generateCommercialOfferPdf } from '@/services/pdf';

describe('POST /api/v1/admin/commercial-offer', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('generates commercial offer on success', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([{ code: 'A1', name: 'Test', priceRetail: 100 }] as any);
    vi.mocked(generateCommercialOfferPdf).mockResolvedValue('/pdfs/offer.pdf');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ productIds: [1] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
  });

  it('returns 422 on validation error', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ productIds: [] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(422);
  });

  it('returns 404 when no products found', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([]);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ productIds: [999] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(404);
  });

  it('returns PdfError status code', async () => {
    const { PdfError } = await import('@/services/pdf');
    vi.mocked(prisma.product.findMany).mockResolvedValue([{ code: 'A1', name: 'Test', priceRetail: 100 }] as any);
    vi.mocked(generateCommercialOfferPdf).mockRejectedValue(new PdfError('pdf failed'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ productIds: [1] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.product.findMany).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ productIds: [1] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });
});
