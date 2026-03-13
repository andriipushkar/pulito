import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => (...args: unknown[]) => handler(...args),
  withOptionalAuth: (handler: Function) => (...args: unknown[]) => handler(...args),
  withRole: (..._roles: string[]) => (handler: Function) => (...args: unknown[]) => handler(...args),
}));

vi.mock('@/services/pricelist', () => ({
  generatePricelist: vi.fn(),
  PricelistError: class PricelistError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

import { GET } from './route';
import { generatePricelist } from '@/services/pricelist';

const mocked = vi.mocked(generatePricelist);

describe('GET /api/v1/pricelist', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns PDF on success for retail', async () => {
    mocked.mockResolvedValue(Buffer.from('pdf-data') as never);
    const req = new NextRequest('http://localhost/api/v1/pricelist?type=retail');
    const res = await GET(req, { user: null, params: Promise.resolve({}) } as any);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
  });

  it('returns 400 on invalid type', async () => {
    const req = new NextRequest('http://localhost/api/v1/pricelist?type=invalid');
    const res = await GET(req, { user: null, params: Promise.resolve({}) } as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on service error', async () => {
    mocked.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/pricelist?type=retail');
    const res = await GET(req, { user: null, params: Promise.resolve({}) } as any);
    expect(res.status).toBe(500);
  });

  it('returns 401 for wholesale pricelist without auth', async () => {
    const req = new NextRequest('http://localhost/api/v1/pricelist?type=wholesale');
    const res = await GET(req, { user: null, params: Promise.resolve({}) } as any);
    expect(res.status).toBe(401);
  });

  it('returns 403 for wholesale pricelist with non-privileged user', async () => {
    const req = new NextRequest('http://localhost/api/v1/pricelist?type=wholesale');
    const res = await GET(req, { user: { id: 1, role: 'client' }, params: Promise.resolve({}) } as any);
    expect(res.status).toBe(403);
  });

  it('returns PDF on success for wholesale with admin', async () => {
    mocked.mockResolvedValue(Buffer.from('pdf-data') as never);
    const req = new NextRequest('http://localhost/api/v1/pricelist?type=wholesale');
    const res = await GET(req, { user: { id: 1, role: 'admin' }, params: Promise.resolve({}) } as any);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toContain('wholesale');
  });

  it('returns PDF on success for wholesale with wholesaler', async () => {
    mocked.mockResolvedValue(Buffer.from('pdf-data') as never);
    const req = new NextRequest('http://localhost/api/v1/pricelist?type=wholesale');
    const res = await GET(req, { user: { id: 1, role: 'wholesaler' }, params: Promise.resolve({}) } as any);
    expect(res.status).toBe(200);
  });

  it('returns PDF on success for wholesale with manager', async () => {
    mocked.mockResolvedValue(Buffer.from('pdf-data') as never);
    const req = new NextRequest('http://localhost/api/v1/pricelist?type=wholesale');
    const res = await GET(req, { user: { id: 1, role: 'manager' }, params: Promise.resolve({}) } as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 when type param is missing', async () => {
    const req = new NextRequest('http://localhost/api/v1/pricelist');
    const res = await GET(req, { user: null, params: Promise.resolve({}) } as any);
    expect(res.status).toBe(400);
  });

  it('handles PricelistError with custom status', async () => {
    const { PricelistError } = await import('@/services/pricelist');
    mocked.mockRejectedValue(new PricelistError('No products', 404));
    const req = new NextRequest('http://localhost/api/v1/pricelist?type=retail');
    const res = await GET(req, { user: null, params: Promise.resolve({}) } as any);
    expect(res.status).toBe(404);
  });
});
