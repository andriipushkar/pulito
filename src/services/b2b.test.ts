import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockProductFindMany = vi.fn();
const mockUserFindUnique = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findMany: (...args: unknown[]) => mockProductFindMany(...args) },
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
  },
}));

import { resolveBulkOrder, checkCreditLimit } from './b2b';

beforeEach(() => vi.clearAllMocks());

const makeProduct = (overrides = {}) => ({
  id: 1,
  code: 'ABC-001',
  name: 'Product A',
  quantity: 100,
  priceRetail: 50,
  priceWholesale: 40,
  priceWholesale2: 35,
  priceWholesale3: 30,
  ...overrides,
});

describe('resolveBulkOrder', () => {
  it('resolves products by code', async () => {
    mockProductFindMany.mockResolvedValue([makeProduct()]);

    const result = await resolveBulkOrder(
      [{ code: 'abc-001', quantity: 5 }],
      null
    );

    expect(result.errors).toEqual([]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      productId: 1,
      code: 'ABC-001',
      quantity: 5,
      price: 50,
      total: 250,
    });
    expect(result.totalAmount).toBe(250);
  });

  it('reports errors for missing codes', async () => {
    mockProductFindMany.mockResolvedValue([]);

    const result = await resolveBulkOrder(
      [{ code: 'NOPE', quantity: 1 }],
      null
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('NOPE');
    expect(result.items).toEqual([]);
  });

  it('reports errors for insufficient stock', async () => {
    mockProductFindMany.mockResolvedValue([makeProduct({ quantity: 2 })]);

    const result = await resolveBulkOrder(
      [{ code: 'abc-001', quantity: 10 }],
      null
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('2');
    expect(result.errors[0]).toContain('10');
    // Item is still added to resolved list (with error logged)
    expect(result.items).toHaveLength(1);
  });

  it('applies wholesale group 1 pricing', async () => {
    mockProductFindMany.mockResolvedValue([makeProduct()]);

    const result = await resolveBulkOrder(
      [{ code: 'abc-001', quantity: 1 }],
      1
    );

    expect(result.items[0].price).toBe(40);
  });

  it('applies wholesale group 2 pricing', async () => {
    mockProductFindMany.mockResolvedValue([makeProduct()]);

    const result = await resolveBulkOrder(
      [{ code: 'abc-001', quantity: 1 }],
      2
    );

    expect(result.items[0].price).toBe(35);
  });

  it('applies wholesale group 3 pricing', async () => {
    mockProductFindMany.mockResolvedValue([makeProduct()]);

    const result = await resolveBulkOrder(
      [{ code: 'abc-001', quantity: 1 }],
      3
    );

    expect(result.items[0].price).toBe(30);
  });

  it('falls back to retail price when wholesale price is null', async () => {
    mockProductFindMany.mockResolvedValue([
      makeProduct({ priceWholesale: null }),
    ]);

    const result = await resolveBulkOrder(
      [{ code: 'abc-001', quantity: 1 }],
      1
    );

    expect(result.items[0].price).toBe(50);
  });
});

describe('checkCreditLimit', () => {
  it('returns true when credit available', async () => {
    mockUserFindUnique.mockResolvedValue({ creditLimit: 10000, creditUsed: 3000 });

    const result = await checkCreditLimit(1, 5000);

    expect(result).toBe(true);
  });

  it('returns false when limit exceeded', async () => {
    mockUserFindUnique.mockResolvedValue({ creditLimit: 10000, creditUsed: 8000 });

    const result = await checkCreditLimit(1, 5000);

    expect(result).toBe(false);
  });

  it('returns false when no credit limit set', async () => {
    mockUserFindUnique.mockResolvedValue({ creditLimit: null, creditUsed: 0 });

    const result = await checkCreditLimit(1, 100);

    expect(result).toBe(false);
  });

  it('returns false when user not found', async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const result = await checkCreditLimit(999, 100);

    expect(result).toBe(false);
  });
});
