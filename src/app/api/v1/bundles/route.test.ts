import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));

vi.mock('@/services/bundle', () => ({
  getActiveBundles: vi.fn(),
  calculateBundlePrice: vi.fn(),
}));

vi.mock('@/utils/api-response', async () => {
  const { NextResponse } = await import('next/server');
  return {
    successResponse: (data: any, status = 200) => NextResponse.json({ success: true, data }, { status }),
    errorResponse: (message: string, status = 500) => NextResponse.json({ success: false, error: message }, { status }),
    paginatedResponse: (data: any, total: number, page: number, limit: number) =>
      NextResponse.json({ success: true, data, meta: { total, page, limit } }),
    parseSearchParams: (sp: URLSearchParams) => ({
      page: Number(sp.get('page')) || 1,
      limit: Math.min(Number(sp.get('limit')) || 20, 100),
    }),
  };
});

import { GET } from './route';
import { getActiveBundles, calculateBundlePrice } from '@/services/bundle';

const mockGetBundles = getActiveBundles as ReturnType<typeof vi.fn>;
const mockCalcPrice = calculateBundlePrice as ReturnType<typeof vi.fn>;

describe('GET /api/v1/bundles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns bundles with pricing', async () => {
    mockGetBundles.mockResolvedValue({ bundles: [{ id: 1, name: 'Bundle' }], total: 1 });
    mockCalcPrice.mockResolvedValue({ originalPrice: 100, bundlePrice: 80 });
    const req = new NextRequest('http://localhost/api/v1/bundles');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data[0].pricing.bundlePrice).toBe(80);
  });

  it('returns 500 on error', async () => {
    mockGetBundles.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/bundles');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
