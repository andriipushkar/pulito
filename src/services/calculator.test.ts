import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    category: { findMany: (...args: unknown[]) => mockFindMany(...args) },
    product: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
  },
}));

import { calculateNeeds } from './calculator';

beforeEach(() => vi.clearAllMocks());

const makeProduct = (overrides = {}) => ({
  id: 1,
  name: 'Test Product',
  code: 'TP-001',
  slug: 'test-product',
  imagePath: null,
  priceRetail: 120,
  ...overrides,
});

describe('calculateNeeds', () => {
  it('returns recommendations when categories and products exist', async () => {
    mockFindMany.mockResolvedValue([
      { id: 10, name: 'Пральні порошки', slug: 'pralni-poroshky' },
      { id: 20, name: 'Миття посуду', slug: 'mytya-posudu' },
    ]);
    mockFindFirst.mockResolvedValue(makeProduct());

    const result = await calculateNeeds({
      familySize: 4,
      washLoadsPerWeek: 5,
      cleaningFrequency: 'weekly',
    });

    expect(result.recommendations.length).toBe(2);
    expect(result.recommendations[0]).toMatchObject({
      productId: 1,
      name: 'Test Product',
      category: 'Пральні порошки',
    });
    expect(result.totalMonthly).toBeGreaterThan(0);
    expect(result.totalQuarterly).toBe(Math.round(result.totalMonthly * 3 * 100) / 100);
  });

  it('returns empty when no matching categories', async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await calculateNeeds({
      familySize: 2,
      washLoadsPerWeek: 3,
      cleaningFrequency: 'weekly',
    });

    expect(result.recommendations).toEqual([]);
    expect(result.totalMonthly).toBe(0);
    expect(result.totalQuarterly).toBe(0);
  });

  it('skips category when no product is found', async () => {
    mockFindMany.mockResolvedValue([
      { id: 10, name: 'Пральні порошки', slug: 'pralni-poroshky' },
    ]);
    mockFindFirst.mockResolvedValue(null);

    const result = await calculateNeeds({
      familySize: 2,
      washLoadsPerWeek: 3,
      cleaningFrequency: 'weekly',
    });

    expect(result.recommendations).toEqual([]);
    expect(result.totalMonthly).toBe(0);
  });

  it('handles family size 1 with minimal loads', async () => {
    mockFindMany.mockResolvedValue([
      { id: 10, name: 'Миття посуду', slug: 'mytya-posudu' },
    ]);
    mockFindFirst.mockResolvedValue(makeProduct({ priceRetail: 50 }));

    const result = await calculateNeeds({
      familySize: 1,
      washLoadsPerWeek: 1,
      cleaningFrequency: 'biweekly',
    });

    expect(result.recommendations.length).toBe(1);
    expect(result.recommendations[0].quantityPerMonth).toBeGreaterThanOrEqual(1);
  });

  it('handles max wash loads (14)', async () => {
    mockFindMany.mockResolvedValue([
      { id: 10, name: 'Пральні порошки', slug: 'pralni-poroshky' },
    ]);
    mockFindFirst.mockResolvedValue(makeProduct({ priceRetail: 200 }));

    const result = await calculateNeeds({
      familySize: 8,
      washLoadsPerWeek: 14,
      cleaningFrequency: 'daily',
    });

    expect(result.recommendations.length).toBe(1);
    expect(result.recommendations[0].quantityPerMonth).toBeGreaterThan(1);
    expect(result.totalMonthly).toBeGreaterThan(0);
  });
});
