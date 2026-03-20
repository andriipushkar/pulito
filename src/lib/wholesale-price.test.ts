import { describe, it, expect } from 'vitest';
import { resolveWholesalePrice } from './wholesale-price';

describe('resolveWholesalePrice', () => {
  const product = {
    priceWholesale: 100,
    priceWholesale2: 90,
    priceWholesale3: 80,
  };

  it('returns group 1 price', () => {
    expect(resolveWholesalePrice(product, 1)).toBe(100);
  });

  it('returns group 2 price', () => {
    expect(resolveWholesalePrice(product, 2)).toBe(90);
  });

  it('returns group 3 price', () => {
    expect(resolveWholesalePrice(product, 3)).toBe(80);
  });

  it('returns null for group 0', () => {
    expect(resolveWholesalePrice(product, 0)).toBeNull();
  });

  it('returns null for null group', () => {
    expect(resolveWholesalePrice(product, null)).toBeNull();
  });

  it('returns null for undefined group', () => {
    expect(resolveWholesalePrice(product, undefined)).toBeNull();
  });

  it('returns null for invalid group number', () => {
    expect(resolveWholesalePrice(product, 4)).toBeNull();
    expect(resolveWholesalePrice(product, -1)).toBeNull();
  });

  it('returns null when wholesale price is null', () => {
    expect(resolveWholesalePrice({ priceWholesale: null }, 1)).toBeNull();
  });

  it('returns null when wholesale price is undefined', () => {
    expect(resolveWholesalePrice({}, 1)).toBeNull();
  });

  it('converts Decimal-like values to number', () => {
    // Prisma returns Decimal objects that have toString
    const decimalProduct = { priceWholesale: { toString: () => '99.50' } as unknown };
    expect(resolveWholesalePrice(decimalProduct, 1)).toBe(99.5);
  });

  it('handles zero price correctly (not null)', () => {
    expect(resolveWholesalePrice({ priceWholesale: 0 }, 1)).toBe(0);
  });
});
