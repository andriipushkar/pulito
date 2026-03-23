import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));

vi.mock('@/services/bundle', () => ({
  getBundleBySlug: vi.fn(),
  calculateBundlePrice: vi.fn(),
}));

vi.mock('@/utils/api-response', async () => {
  const { NextResponse } = await import('next/server');
  return {
    successResponse: (data: any, status = 200) => NextResponse.json({ success: true, data }, { status }),
    errorResponse: (message: string, status = 500) => NextResponse.json({ success: false, error: message }, { status }),
  };
});

import { GET } from './route';
import { getBundleBySlug, calculateBundlePrice } from '@/services/bundle';

const mockGetBundle = getBundleBySlug as ReturnType<typeof vi.fn>;
const mockCalcPrice = calculateBundlePrice as ReturnType<typeof vi.fn>;

describe('GET /api/v1/bundles/[slug]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 if bundle not found', async () => {
    mockGetBundle.mockResolvedValue(null);
    const req = new NextRequest('http://localhost');
    const res = await GET(req, { params: Promise.resolve({ slug: 'no-bundle' }) });
    expect(res.status).toBe(404);
  });

  it('returns bundle with pricing', async () => {
    mockGetBundle.mockResolvedValue({ id: 1, name: 'Bundle', slug: 'bundle' });
    mockCalcPrice.mockResolvedValue({ originalPrice: 100, bundlePrice: 80 });
    const req = new NextRequest('http://localhost');
    const res = await GET(req, { params: Promise.resolve({ slug: 'bundle' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.pricing.bundlePrice).toBe(80);
  });

  it('returns 500 on error', async () => {
    mockGetBundle.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost');
    const res = await GET(req, { params: Promise.resolve({ slug: 'bundle' }) });
    expect(res.status).toBe(500);
  });
});
