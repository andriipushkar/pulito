import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
    APP_URL: 'https://test.com',
    APP_SECRET: 'test-app-secret',
  },
}));
vi.mock('@/middleware/auth', () => ({
  withRole: (..._roles: string[]) => (handler: any) => handler,
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findUnique: vi.fn() },
  },
}));
vi.mock('@/services/channel-config', () => ({
  getChannelConfig: vi.fn(),
}));
vi.mock('@/services/marketplace-categories', () => ({
  resolveExternalCategory: vi.fn(),
}));
vi.mock('@/services/marketplaces', () => ({
  validateForMarketplace: () => ({ valid: true, errors: [], warnings: [] }),
}));
vi.mock('@/services/marketplace-health', () => ({
  MARKETPLACE_PLATFORMS: ['olx', 'rozetka', 'prom', 'epicentrk'],
  isMarketplacePlatform: (p: string) => ['olx', 'rozetka', 'prom', 'epicentrk'].includes(p),
}));

import { POST } from './route';
import { prisma } from '@/lib/prisma';
import { getChannelConfig } from '@/services/channel-config';
import { resolveExternalCategory } from '@/services/marketplace-categories';

const mockProd = vi.mocked(prisma.product.findUnique);
const mockConf = vi.mocked(getChannelConfig);
const mockResolve = vi.mocked(resolveExternalCategory);

const baseProduct = {
  id: 1,
  name: 'Test',
  code: 'SKU-1',
  priceRetail: 100,
  quantity: 10,
  categoryId: 5,
  excludedMarketplaces: [],
  content: { fullDescription: 'A long enough description for validation purposes that is over fifty characters total.' },
  images: [
    { pathFull: '/uploads/img-1.webp', pathOriginal: null, pathMedium: null, width: 1200, height: 1200 },
    { pathFull: '/uploads/img-2.webp', pathOriginal: null, pathMedium: null, width: 600, height: 600 },
  ],
};

const makeReq = () =>
  new Request('http://localhost', { method: 'POST', body: '{}' });

describe('POST /api/v1/admin/products/[id]/marketplaces/validate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProd.mockResolvedValue(baseProduct as any);
    mockConf.mockResolvedValue({ enabled: true } as any);
    mockResolve.mockResolvedValue('cat-100');
  });

  it('returns per-platform validation for all 4 marketplaces', async () => {
    const res = await POST(makeReq() as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(4);
    const platforms = json.data.map((d: any) => d.platform).sort();
    expect(platforms).toEqual(['epicentrk', 'olx', 'prom', 'rozetka']);
  });

  it('flags small images per platform threshold', async () => {
    const res = await POST(makeReq() as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    const olx = json.data.find((d: any) => d.platform === 'olx');
    const rozetka = json.data.find((d: any) => d.platform === 'rozetka');
    // 600px < 800 (OLX) AND < 1000 (Rozetka) — img 2 counts for both
    // 1200px > 800 AND > 1000 — img 1 OK for both
    expect(olx.smallImages).toBe(1);
    expect(rozetka.smallImages).toBe(1);
  });

  it('marks categoryStatus=fallback when no mapping but defaultCategoryId exists', async () => {
    mockResolve.mockResolvedValue(null);
    mockConf.mockResolvedValue({ enabled: true, defaultCategoryId: '999' } as any);

    const res = await POST(makeReq() as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(json.data[0].categoryStatus).toBe('fallback');
    expect(json.data[0].warnings.some((w: string) => w.includes('дефолтну'))).toBe(true);
  });

  it('marks invalid when category unmappable and no defaultCategoryId', async () => {
    mockResolve.mockResolvedValue(null);
    mockConf.mockResolvedValue({ enabled: true } as any);

    const res = await POST(makeReq() as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(json.data[0].valid).toBe(false);
    expect(json.data[0].errors.some((e: string) => e.includes('Категорія'))).toBe(true);
  });

  it('warns when product is excluded from a platform', async () => {
    mockProd.mockResolvedValue({ ...baseProduct, excludedMarketplaces: ['olx'] } as any);

    const res = await POST(makeReq() as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    const olx = json.data.find((d: any) => d.platform === 'olx');
    expect(olx.valid).toBe(false);
    expect(olx.warnings.some((w: string) => w.includes('виключено'))).toBe(true);
  });

  it('marks configured=false when channel is disabled', async () => {
    mockConf.mockResolvedValue({ enabled: false } as any);

    const res = await POST(makeReq() as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(json.data[0].configured).toBe(false);
    expect(json.data[0].valid).toBe(false);
  });

  it('returns 404 when product not found', async () => {
    mockProd.mockResolvedValue(null as any);

    const res = await POST(makeReq() as any, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(404);
  });
});
