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
    category: { findMany: vi.fn() },
    product: { findMany: vi.fn() },
  },
}));
vi.mock('@/services/marketplace-categories', () => ({
  getAllCategoryMappings: vi.fn(),
}));

import { GET } from './route';
import { prisma } from '@/lib/prisma';
import { getAllCategoryMappings } from '@/services/marketplace-categories';

const mockCats = vi.mocked(prisma.category.findMany);
const mockProds = vi.mocked(prisma.product.findMany);
const mockMaps = vi.mocked(getAllCategoryMappings);

describe('GET /api/v1/admin/marketplaces/categories/coverage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('computes coverage stats with mapped and unmapped categories', async () => {
    mockCats.mockResolvedValue([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ] as any);
    mockProds.mockResolvedValue([
      { id: 100, categoryId: 1 },
      { id: 101, categoryId: 1 },
      { id: 102, categoryId: 2 },
      { id: 103, categoryId: 3 },
      { id: 104, categoryId: null },
    ] as any);
    mockMaps.mockResolvedValue({
      olx: { '1': { externalId: 'olx-1' } },
      rozetka: { '1': { externalId: 'r-1' }, '2': { externalId: 'r-2' } },
      prom: {},
      epicentrk: {},
    } as any);

    const res = await (GET as any)({});
    const json = await res.json();

    expect(res.status).toBe(200);
    const byPlatform = Object.fromEntries(
      (json.data as any[]).map((c) => [c.platform, c]),
    );

    expect(byPlatform.olx).toMatchObject({
      mappedCategories: 1,
      totalActiveProducts: 5,
      productsWithMapping: 2, // products in cat 1
      productsWithoutMapping: 2, // products in cat 2 and cat 3 (5 total - 1 uncategorized - 2 mapped)
      uncategorizedProducts: 1,
    });
    expect(byPlatform.olx.unmappedCategoryIds.sort()).toEqual([2, 3]);

    expect(byPlatform.rozetka).toMatchObject({
      mappedCategories: 2,
      productsWithMapping: 3, // cat 1 (2) + cat 2 (1)
      productsWithoutMapping: 1, // only cat 3
    });
    expect(byPlatform.rozetka.unmappedCategoryIds).toEqual([3]);

    expect(byPlatform.prom).toMatchObject({
      mappedCategories: 0,
      productsWithMapping: 0,
    });
  });

  it('returns 500 on DB error', async () => {
    mockCats.mockRejectedValue(new Error('boom'));
    const res = await (GET as any)({});
    expect(res.status).toBe(500);
  });
});
