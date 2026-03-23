import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));

vi.mock('@/services/volume-pricing', () => ({
  getVolumeDiscountsForProduct: vi.fn(),
}));

vi.mock('@/utils/api-response', async () => {
  const { NextResponse } = await import('next/server');
  return {
    successResponse: (data: any, status = 200) => NextResponse.json({ success: true, data }, { status }),
    errorResponse: (message: string, status = 500) => NextResponse.json({ success: false, error: message }, { status }),
  };
});

import { GET } from './route';
import { getVolumeDiscountsForProduct } from '@/services/volume-pricing';

const mockGetDiscounts = getVolumeDiscountsForProduct as ReturnType<typeof vi.fn>;

describe('GET /api/v1/volume-discounts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 without productId', async () => {
    const req = new NextRequest('http://localhost/api/v1/volume-discounts');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns volume discounts', async () => {
    mockGetDiscounts.mockResolvedValue([
      { id: 1, minQuantity: 5, maxQuantity: 10, discountPercent: 5, discountType: 'percentage' },
    ]);
    const req = new NextRequest('http://localhost/api/v1/volume-discounts?productId=1');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data[0].minQuantity).toBe(5);
  });

  it('passes categoryId when provided', async () => {
    mockGetDiscounts.mockResolvedValue([]);
    const req = new NextRequest('http://localhost/api/v1/volume-discounts?productId=1&categoryId=2');
    await GET(req);
    expect(mockGetDiscounts).toHaveBeenCalledWith(1, 2);
  });

  it('returns 500 on error', async () => {
    mockGetDiscounts.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/volume-discounts?productId=1');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
