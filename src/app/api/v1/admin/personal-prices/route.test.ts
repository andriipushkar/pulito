import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: Function) => (...args: unknown[]) => handler(...args) }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/validators/personal-price', () => ({
  personalPriceFilterSchema: { safeParse: vi.fn() },
  createPersonalPriceSchema: { safeParse: vi.fn() },
}));
vi.mock('@/services/personal-price', () => ({
  getPersonalPrices: vi.fn(),
  createPersonalPrice: vi.fn(),
  PersonalPriceError: class PersonalPriceError extends Error { statusCode = 400; },
}));

import { GET, POST } from './route';
import { getPersonalPrices, createPersonalPrice } from '@/services/personal-price';
import { personalPriceFilterSchema, createPersonalPriceSchema } from '@/validators/personal-price';

describe('GET /api/v1/admin/personal-prices', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns personal prices on success', async () => {
    vi.mocked(personalPriceFilterSchema.safeParse).mockReturnValue({ success: true, data: { page: 1, limit: 20 } } as any);
    vi.mocked(getPersonalPrices).mockResolvedValue({ items: [], total: 0 });
    const req = new NextRequest('http://localhost/api/v1/admin/personal-prices');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 on GET filter validation error', async () => {
    vi.mocked(personalPriceFilterSchema.safeParse).mockReturnValue({ success: false, error: { issues: [{ message: 'bad' }] } } as any);
    const req = new NextRequest('http://localhost/api/v1/admin/personal-prices');
    const res = await GET(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(personalPriceFilterSchema.safeParse).mockReturnValue({ success: true, data: { page: 1, limit: 20 } } as any);
    vi.mocked(getPersonalPrices).mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/admin/personal-prices');
    const res = await GET(req as any);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/admin/personal-prices', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates personal price on success', async () => {
    vi.mocked(createPersonalPriceSchema.safeParse).mockReturnValue({ success: true, data: { userId: 1, productId: 1, price: 50 } } as any);
    vi.mocked(createPersonalPrice).mockResolvedValue({ id: 1 } as any);
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ userId: 1, productId: 1, price: 50 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, { user: { id: 1 } } as any);
    expect(res.status).toBe(201);
  });

  it('returns 400 on POST validation error', async () => {
    vi.mocked(createPersonalPriceSchema.safeParse).mockReturnValue({ success: false, error: { issues: [{ message: 'bad price' }] } } as any);
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ userId: 1 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, { user: { id: 1 } } as any);
    expect(res.status).toBe(400);
  });

  it('returns PersonalPriceError status code', async () => {
    const { PersonalPriceError } = await import('@/services/personal-price');
    vi.mocked(createPersonalPriceSchema.safeParse).mockReturnValue({ success: true, data: { userId: 1, productId: 1, price: 50 } } as any);
    vi.mocked(createPersonalPrice).mockRejectedValue(new (PersonalPriceError as any)('duplicate'));
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ userId: 1, productId: 1, price: 50 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, { user: { id: 1 } } as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(createPersonalPriceSchema.safeParse).mockReturnValue({ success: true, data: { userId: 1, productId: 1, price: 50 } } as any);
    vi.mocked(createPersonalPrice).mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ userId: 1, productId: 1, price: 50 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, { user: { id: 1 } } as any);
    expect(res.status).toBe(500);
  });
});
