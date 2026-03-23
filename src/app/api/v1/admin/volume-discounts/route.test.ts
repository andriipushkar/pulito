import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/services/volume-pricing', () => ({
  getVolumeDiscounts: vi.fn(),
  createVolumeDiscount: vi.fn(),
  VolumePricingError: class VolumePricingError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));
vi.mock('@/validators/volume-discount', () => ({
  createVolumeDiscountSchema: {
    safeParse: vi.fn((data: any) => {
      if (data.minQuantity && data.discountPercent) return { success: true, data };
      return { success: false, error: { issues: [{ message: 'Invalid data' }] } };
    }),
  },
}));

import { GET, POST } from './route';
import { getVolumeDiscounts, createVolumeDiscount, VolumePricingError } from '@/services/volume-pricing';
import { NextRequest } from 'next/server';

describe('GET /api/v1/admin/volume-discounts', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns volume discounts', async () => {
    const items = [{ id: 1, minQuantity: 10, discountPercent: 5 }];
    vi.mocked(getVolumeDiscounts).mockResolvedValue(items as any);

    const req = new NextRequest('http://localhost/api/v1/admin/volume-discounts');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual(items);
  });

  it('returns 500 on error', async () => {
    vi.mocked(getVolumeDiscounts).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost/api/v1/admin/volume-discounts');
    const res = await GET(req);

    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/admin/volume-discounts', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates a volume discount', async () => {
    const item = { id: 1, minQuantity: 10, discountPercent: 5 };
    vi.mocked(createVolumeDiscount).mockResolvedValue(item as any);

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minQuantity: 10, discountPercent: 5 }),
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data).toEqual(item);
  });

  it('returns 400 for validation error', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it('returns VolumePricingError status code', async () => {
    vi.mocked(createVolumeDiscount).mockRejectedValue(new VolumePricingError('Conflict', 409));

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minQuantity: 10, discountPercent: 5 }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(409);
  });

  it('returns 500 on generic error', async () => {
    vi.mocked(createVolumeDiscount).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minQuantity: 10, discountPercent: 5 }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(500);
  });
});
