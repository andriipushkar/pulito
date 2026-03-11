import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockPrismaClient } from '@/test/prisma-mock';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
const mockPrisma = prisma as unknown as MockPrismaClient;

import {
  QuickOrderError,
  parseQuickOrderInput,
  resolveQuickOrder,
} from './quick-order';

beforeEach(() => {
  vi.clearAllMocks();
});

/* ------------------------------------------------------------------ */
/*  QuickOrderError                                                   */
/* ------------------------------------------------------------------ */
describe('QuickOrderError', () => {
  it('has default statusCode 400', () => {
    const err = new QuickOrderError('test');
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('test');
    expect(err.name).toBe('QuickOrderError');
  });

  it('accepts a custom statusCode', () => {
    const err = new QuickOrderError('not found', 404);
    expect(err.statusCode).toBe(404);
  });

  it('is an instance of Error', () => {
    expect(new QuickOrderError('x')).toBeInstanceOf(Error);
  });
});

/* ------------------------------------------------------------------ */
/*  parseQuickOrderInput                                              */
/* ------------------------------------------------------------------ */
describe('parseQuickOrderInput', () => {
  it('parses tab-separated lines', () => {
    const input = 'ABC-001\t5\nDEF-002\t10';
    const result = parseQuickOrderInput(input);
    expect(result).toEqual([
      { code: 'ABC-001', quantity: 5 },
      { code: 'DEF-002', quantity: 10 },
    ]);
  });

  it('parses comma-separated lines', () => {
    const input = 'ABC-001,5\nDEF-002,10';
    const result = parseQuickOrderInput(input);
    expect(result).toEqual([
      { code: 'ABC-001', quantity: 5 },
      { code: 'DEF-002', quantity: 10 },
    ]);
  });

  it('parses semicolon-separated lines', () => {
    const input = 'ABC-001;5\nDEF-002;10';
    const result = parseQuickOrderInput(input);
    expect(result).toEqual([
      { code: 'ABC-001', quantity: 5 },
      { code: 'DEF-002', quantity: 10 },
    ]);
  });

  it('skips lines with only one part', () => {
    const input = 'ABC-001\nDEF-002\t3';
    const result = parseQuickOrderInput(input);
    expect(result).toEqual([{ code: 'DEF-002', quantity: 3 }]);
  });

  it('skips lines with NaN quantity', () => {
    const input = 'ABC-001\tabc\nDEF-002\t3';
    const result = parseQuickOrderInput(input);
    expect(result).toEqual([{ code: 'DEF-002', quantity: 3 }]);
  });

  it('skips lines with zero quantity', () => {
    const input = 'ABC-001\t0\nDEF-002\t3';
    const result = parseQuickOrderInput(input);
    expect(result).toEqual([{ code: 'DEF-002', quantity: 3 }]);
  });

  it('skips lines with negative quantity', () => {
    const input = 'ABC-001\t-5\nDEF-002\t3';
    const result = parseQuickOrderInput(input);
    expect(result).toEqual([{ code: 'DEF-002', quantity: 3 }]);
  });

  it('returns empty array for empty input', () => {
    expect(parseQuickOrderInput('')).toEqual([]);
    expect(parseQuickOrderInput('   ')).toEqual([]);
    expect(parseQuickOrderInput('\n\n')).toEqual([]);
  });

  it('handles multiple spaces as separator', () => {
    const input = 'ABC-001   5\nDEF-002    10';
    const result = parseQuickOrderInput(input);
    expect(result).toEqual([
      { code: 'ABC-001', quantity: 5 },
      { code: 'DEF-002', quantity: 10 },
    ]);
  });

  it('uses the last part as quantity when there are extra parts', () => {
    const input = 'ABC-001\tSome Name\t5';
    const result = parseQuickOrderInput(input);
    expect(result).toEqual([{ code: 'ABC-001', quantity: 5 }]);
  });

  it('trims surrounding whitespace from the input', () => {
    const input = '  \n  ABC-001\t5\n  ';
    const result = parseQuickOrderInput(input);
    expect(result).toEqual([{ code: 'ABC-001', quantity: 5 }]);
  });
});

/* ------------------------------------------------------------------ */
/*  resolveQuickOrder                                                 */
/* ------------------------------------------------------------------ */
describe('resolveQuickOrder', () => {
  it('throws QuickOrderError on empty array', async () => {
    await expect(resolveQuickOrder([])).rejects.toThrow(QuickOrderError);
    await expect(resolveQuickOrder([])).rejects.toThrow(
      'Не вказано жодного товару'
    );
  });

  it('returns "found" for products with sufficient stock', async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 1,
        code: 'ABC-001',
        name: 'Product A',
        slug: 'product-a',
        priceRetail: 100,
        priceWholesale: 80,
        quantity: 50,
        imagePath: '/img/a.jpg',
      },
    ]);

    const result = await resolveQuickOrder([{ code: 'ABC-001', quantity: 5 }]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      code: 'ABC-001',
      requestedQuantity: 5,
      productId: 1,
      productName: 'Product A',
      productSlug: 'product-a',
      priceRetail: 100,
      priceWholesale: 80,
      availableQuantity: 50,
      imagePath: '/img/a.jpg',
      status: 'found',
    });
  });

  it('returns "not_found" for missing products', async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);

    const result = await resolveQuickOrder([
      { code: 'MISSING-001', quantity: 2 },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      code: 'MISSING-001',
      requestedQuantity: 2,
      productId: null,
      productName: null,
      productSlug: null,
      priceRetail: null,
      priceWholesale: null,
      availableQuantity: null,
      imagePath: null,
      status: 'not_found',
    });
  });

  it('returns "insufficient_stock" when requested quantity exceeds available', async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 2,
        code: 'DEF-002',
        name: 'Product B',
        slug: 'product-b',
        priceRetail: 200,
        priceWholesale: 160,
        quantity: 3,
        imagePath: '/img/b.jpg',
      },
    ]);

    const result = await resolveQuickOrder([
      { code: 'DEF-002', quantity: 10 },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('insufficient_stock');
    expect(result[0].availableQuantity).toBe(3);
    expect(result[0].requestedQuantity).toBe(10);
    expect(result[0].productId).toBe(2);
  });

  it('handles a mix of found, not_found, and insufficient_stock', async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 1,
        code: 'A',
        name: 'Found Product',
        slug: 'found',
        priceRetail: 100,
        priceWholesale: 80,
        quantity: 50,
        imagePath: '/img/found.jpg',
      },
      {
        id: 3,
        code: 'C',
        name: 'Low Stock',
        slug: 'low-stock',
        priceRetail: 300,
        priceWholesale: 240,
        quantity: 1,
        imagePath: null,
      },
    ]);

    const result = await resolveQuickOrder([
      { code: 'A', quantity: 5 },
      { code: 'B', quantity: 2 },
      { code: 'C', quantity: 10 },
    ]);

    expect(result).toHaveLength(3);
    expect(result[0].status).toBe('found');
    expect(result[0].code).toBe('A');
    expect(result[1].status).toBe('not_found');
    expect(result[1].code).toBe('B');
    expect(result[2].status).toBe('insufficient_stock');
    expect(result[2].code).toBe('C');
  });

  it('queries prisma with correct codes and isActive filter', async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);

    await resolveQuickOrder([
      { code: 'X1', quantity: 1 },
      { code: 'X2', quantity: 2 },
    ]);

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
      where: { code: { in: ['X1', 'X2'] }, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        slug: true,
        priceRetail: true,
        priceWholesale: true,
        quantity: true,
        imagePath: true,
      },
    });
  });

  it('returns "found" when quantity exactly equals available stock', async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 5,
        code: 'EXACT',
        name: 'Exact Stock',
        slug: 'exact-stock',
        priceRetail: 50,
        priceWholesale: 40,
        quantity: 7,
        imagePath: null,
      },
    ]);

    const result = await resolveQuickOrder([{ code: 'EXACT', quantity: 7 }]);

    expect(result[0].status).toBe('found');
    expect(result[0].availableQuantity).toBe(7);
    expect(result[0].requestedQuantity).toBe(7);
  });
});
