import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockBundleFindUnique = vi.fn();
const mockBundleCreate = vi.fn();
const mockProductFindMany = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    bundle: {
      findUnique: (...args: unknown[]) => mockBundleFindUnique(...args),
      create: (...args: unknown[]) => mockBundleCreate(...args),
    },
    product: {
      findMany: (...args: unknown[]) => mockProductFindMany(...args),
    },
  },
}));

vi.mock('@/utils/slug', () => ({
  createSlug: (text: string) => text.toLowerCase().replace(/\s+/g, '-'),
}));

vi.mock('@/services/cart', () => ({
  addToCart: vi.fn(),
}));

import { createBundle, calculateBundlePrice, getBundleBySlug } from './bundle';

beforeEach(() => vi.clearAllMocks());

describe('createBundle', () => {
  it('creates bundle with items', async () => {
    mockBundleFindUnique.mockResolvedValue(null); // no slug conflict
    mockProductFindMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const created = { id: 1, name: 'Starter Kit', slug: 'starter-kit', items: [] };
    mockBundleCreate.mockResolvedValue(created);

    const result = await createBundle(
      {
        name: 'Starter Kit',
        bundleType: 'curated',
        items: [
          { productId: 1, quantity: 2 },
          { productId: 2, quantity: 1 },
        ],
      },
      1
    );

    expect(result).toEqual(created);
    expect(mockBundleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Starter Kit',
          slug: 'starter-kit',
          createdBy: 1,
        }),
      })
    );
  });

  it('throws on duplicate slug', async () => {
    mockBundleFindUnique.mockResolvedValue({ id: 99 });

    await expect(
      createBundle({ name: 'Kit', bundleType: 'curated', items: [{ productId: 1, quantity: 1 }] }, 1)
    ).rejects.toThrow();
  });

  it('throws when products not found', async () => {
    mockBundleFindUnique.mockResolvedValue(null);
    mockProductFindMany.mockResolvedValue([{ id: 1 }]); // only 1 of 2

    await expect(
      createBundle(
        { name: 'Kit', bundleType: 'curated', items: [{ productId: 1, quantity: 1 }, { productId: 2, quantity: 1 }] },
        1
      )
    ).rejects.toThrow();
  });
});

describe('calculateBundlePrice', () => {
  it('applies percentage discount', async () => {
    mockBundleFindUnique.mockResolvedValue({
      id: 1,
      fixedPrice: null,
      discountPercent: 10,
      items: [
        { product: { priceRetail: 100 }, quantity: 2 },
        { product: { priceRetail: 50 }, quantity: 1 },
      ],
    });

    const result = await calculateBundlePrice(1);

    expect(result.originalPrice).toBe(250);
    expect(result.finalPrice).toBe(225);
    expect(result.savings).toBe(25);
  });

  it('uses fixed price when set', async () => {
    mockBundleFindUnique.mockResolvedValue({
      id: 1,
      fixedPrice: 180,
      discountPercent: 0,
      items: [
        { product: { priceRetail: 100 }, quantity: 2 },
        { product: { priceRetail: 50 }, quantity: 1 },
      ],
    });

    const result = await calculateBundlePrice(1);

    expect(result.originalPrice).toBe(250);
    expect(result.finalPrice).toBe(180);
    expect(result.savings).toBe(70);
  });

  it('throws when bundle not found', async () => {
    mockBundleFindUnique.mockResolvedValue(null);

    await expect(calculateBundlePrice(999)).rejects.toThrow();
  });
});

describe('getBundleBySlug', () => {
  it('returns bundle with products', async () => {
    const bundle = {
      id: 1,
      slug: 'starter',
      items: [{ product: { id: 1, name: 'Soap' } }],
    };
    mockBundleFindUnique.mockResolvedValue(bundle);

    const result = await getBundleBySlug('starter');

    expect(result).toEqual(bundle);
    expect(mockBundleFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: 'starter', isActive: true },
      })
    );
  });

  it('returns null when not found', async () => {
    mockBundleFindUnique.mockResolvedValue(null);

    const result = await getBundleBySlug('nope');

    expect(result).toBeNull();
  });
});
