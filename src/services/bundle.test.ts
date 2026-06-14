import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockBundleFindUnique = vi.fn();
const mockBundleCreate = vi.fn();
const mockBundleFindMany = vi.fn();
const mockProductFindMany = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    bundle: {
      findUnique: (...args: unknown[]) => mockBundleFindUnique(...args),
      create: (...args: unknown[]) => mockBundleCreate(...args),
      findMany: (...args: unknown[]) => mockBundleFindMany(...args),
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

import {
  createBundle,
  calculateBundlePrice,
  getBundleBySlug,
  detectBundleDiscounts,
} from './bundle';

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
      1,
    );

    expect(result).toEqual(created);
    expect(mockBundleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Starter Kit',
          slug: 'starter-kit',
          createdBy: 1,
        }),
      }),
    );
  });

  it('throws on duplicate slug', async () => {
    mockBundleFindUnique.mockResolvedValue({ id: 99 });

    await expect(
      createBundle(
        { name: 'Kit', bundleType: 'curated', items: [{ productId: 1, quantity: 1 }] },
        1,
      ),
    ).rejects.toThrow();
  });

  it('throws when products not found', async () => {
    mockBundleFindUnique.mockResolvedValue(null);
    mockProductFindMany.mockResolvedValue([{ id: 1 }]); // only 1 of 2

    await expect(
      createBundle(
        {
          name: 'Kit',
          bundleType: 'curated',
          items: [
            { productId: 1, quantity: 1 },
            { productId: 2, quantity: 1 },
          ],
        },
        1,
      ),
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
      }),
    );
  });

  it('returns null when not found', async () => {
    mockBundleFindUnique.mockResolvedValue(null);

    const result = await getBundleBySlug('nope');

    expect(result).toBeNull();
  });
});

describe('detectBundleDiscounts', () => {
  // Бандл: 1×A (роздріб 100) + 2×B (роздріб 50), знижка 10% → original 200,
  // фінальна ціна комплекту 180.
  const makeBundle = (overrides?: Record<string, unknown>) => ({
    id: 7,
    name: 'Набір для кухні',
    isActive: true,
    discountPercent: 10,
    fixedPrice: null,
    items: [
      {
        productId: 1,
        quantity: 1,
        product: { priceRetail: 100, priceRetailOld: null, isPromo: false },
      },
      {
        productId: 2,
        quantity: 2,
        product: { priceRetail: 50, priceRetailOld: null, isPromo: false },
      },
    ],
    ...overrides,
  });

  it('returns zero for an empty cart without touching the DB', async () => {
    const result = await detectBundleDiscounts([]);

    expect(result).toEqual({ totalDiscount: 0, applied: [] });
    expect(mockBundleFindMany).not.toHaveBeenCalled();
  });

  it('applies the discount when the cart contains a complete set', async () => {
    mockBundleFindMany.mockResolvedValue([makeBundle()]);

    const result = await detectBundleDiscounts([
      { productId: 1, price: 100, quantity: 1 },
      { productId: 2, price: 50, quantity: 2 },
    ]);

    // cart cost 200 − bundle price 180 = 20
    expect(result.totalDiscount).toBe(20);
    expect(result.applied).toEqual([
      { bundleId: 7, name: 'Набір для кухні', sets: 1, discount: 20 },
    ]);
  });

  it('gives no discount for an incomplete set', async () => {
    mockBundleFindMany.mockResolvedValue([makeBundle()]);

    const result = await detectBundleDiscounts([
      { productId: 1, price: 100, quantity: 1 },
      { productId: 2, price: 50, quantity: 1 }, // потрібно 2
    ]);

    expect(result).toEqual({ totalDiscount: 0, applied: [] });
  });

  it('multiplies the discount for multiple complete sets', async () => {
    mockBundleFindMany.mockResolvedValue([makeBundle()]);

    const result = await detectBundleDiscounts([
      { productId: 1, price: 100, quantity: 2 },
      { productId: 2, price: 50, quantity: 4 },
    ]);

    expect(result.totalDiscount).toBe(40);
    expect(result.applied[0]).toMatchObject({ sets: 2, discount: 40 });
  });

  it('clamps to zero when cart prices are already below the bundle price (wholesale)', async () => {
    mockBundleFindMany.mockResolvedValue([makeBundle()]);

    const result = await detectBundleDiscounts([
      { productId: 1, price: 80, quantity: 1 },
      { productId: 2, price: 40, quantity: 2 },
    ]);

    // оптова вартість 160 < ціна комплекту 180 → без знижки, без подвійних знижок
    expect(result).toEqual({ totalDiscount: 0, applied: [] });
  });

  it('uses fixedPrice when set', async () => {
    mockBundleFindMany.mockResolvedValue([makeBundle({ fixedPrice: 150 })]);

    const result = await detectBundleDiscounts([
      { productId: 1, price: 100, quantity: 1 },
      { productId: 2, price: 50, quantity: 2 },
    ]);

    expect(result.totalDiscount).toBe(50);
  });

  it('does not reuse the same cart units across overlapping bundles', async () => {
    const overlapping = makeBundle({
      id: 8,
      name: 'Дубль-набір',
      discountPercent: 5, // менш вигідний — програє жадібному вибору
    });
    mockBundleFindMany.mockResolvedValue([overlapping, makeBundle()]);

    const result = await detectBundleDiscounts([
      { productId: 1, price: 100, quantity: 1 },
      { productId: 2, price: 50, quantity: 2 },
    ]);

    // Одиниць вистачає лише на один комплект — застосовується вигідніший (10%).
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0]).toMatchObject({ bundleId: 7, discount: 20 });
  });
});
