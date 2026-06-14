import { describe, it, expect } from 'vitest';
import { computeRetailPrice } from './markup';

describe('computeRetailPrice', () => {
  it('adds a percent markup', () => {
    expect(computeRetailPrice(100, 'percent', 30, null)).toBe(130);
  });

  it('adds a fixed markup', () => {
    expect(computeRetailPrice(100, 'fixed', 12.5, null)).toBe(112.5);
  });

  it('rounds to the kopeck', () => {
    // 100.55 + 10% (10.06) = 110.61
    expect(computeRetailPrice(100.55, 'percent', 10, null)).toBe(110.61);
  });

  it('floors at minPrice when the computed price is lower', () => {
    expect(computeRetailPrice(100, 'percent', 0, 150)).toBe(150);
  });

  it('ignores minPrice when the computed price is already above it', () => {
    expect(computeRetailPrice(100, 'percent', 50, 120)).toBe(150);
  });

  it('zero markup returns cost unchanged', () => {
    expect(computeRetailPrice(80, 'percent', 0, null)).toBe(80);
  });
});
