import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/pdf-catalog', () => ({
  generatePriceList: vi.fn(),
  generateIllustratedCatalog: vi.fn(),
  PdfCatalogError: class PdfCatalogError extends Error { statusCode = 400; },
}));

import { POST } from './route';
import { generatePriceList, generateIllustratedCatalog } from '@/services/pdf-catalog';

describe('POST /api/v1/admin/catalog-pdf', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('generates pricelist PDF on success', async () => {
    vi.mocked(generatePriceList).mockResolvedValue('/pdfs/pricelist.pdf');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ type: 'pricelist', priceType: 'retail' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
  });

  it('generates pricelist with categoryId', async () => {
    vi.mocked(generatePriceList).mockResolvedValue('/pdfs/pricelist.pdf');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ type: 'pricelist', categoryId: '5' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
    expect(vi.mocked(generatePriceList)).toHaveBeenCalledWith({ type: 'retail', categoryId: 5 });
  });

  it('generates illustrated catalog on success', async () => {
    vi.mocked(generateIllustratedCatalog).mockResolvedValue('/pdfs/catalog.pdf');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ type: 'illustrated', promoOnly: true }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.url).toBe('/pdfs/catalog.pdf');
  });

  it('returns 400 for unknown type', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ type: 'unknown' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('handles PdfCatalogError', async () => {
    const { PdfCatalogError } = await import('@/services/pdf-catalog');
    vi.mocked(generatePriceList).mockRejectedValue(new PdfCatalogError('No products'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ type: 'pricelist' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('generates illustrated catalog with categoryId', async () => {
    vi.mocked(generateIllustratedCatalog).mockResolvedValue('/pdfs/catalog.pdf');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ type: 'illustrated', categoryId: '3' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
    expect(vi.mocked(generateIllustratedCatalog)).toHaveBeenCalledWith({
      categoryId: 3,
      promoOnly: false,
    });
  });

  it('generates illustrated catalog without categoryId', async () => {
    vi.mocked(generateIllustratedCatalog).mockResolvedValue('/pdfs/catalog.pdf');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ type: 'illustrated' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
    expect(vi.mocked(generateIllustratedCatalog)).toHaveBeenCalledWith({
      categoryId: undefined,
      promoOnly: false,
    });
  });

  it('returns 500 on unexpected error', async () => {
    vi.mocked(generatePriceList).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ type: 'pricelist' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });
});
