import { describe, it, expect } from 'vitest';
import {
  toCents,
  fromCents,
  round2,
  lineTotal,
  sumMoney,
  addMoney,
  subtractMoney,
  percentOf,
  compareMoney,
  minMoney,
  maxMoney,
  clampMoney,
} from './money';

describe('money — int-kopeck arithmetic', () => {
  describe('toCents / fromCents', () => {
    it('round-trips a 2dp amount exactly', () => {
      expect(toCents(10.05)).toBe(1005);
      expect(fromCents(1005)).toBe(10.05);
      expect(fromCents(toCents(99.99))).toBe(99.99);
    });

    it('absorbs float representation error', () => {
      // 10.05 is not exactly representable; toCents must still yield 1005.
      expect(toCents(10.05)).toBe(1005);
      expect(toCents(0.1 + 0.2)).toBe(30); // 0.30000000000000004 → 30
    });

    it('accepts numeric strings and Decimal-like objects', () => {
      expect(toCents('12.34')).toBe(1234);
      expect(toCents({ toString: () => '56.78' })).toBe(5678);
    });
  });

  describe('round2', () => {
    it('clamps to kopecks', () => {
      expect(round2(0.1 + 0.2)).toBe(0.3);
      expect(round2(10.055)).toBe(10.06);
      expect(round2(10.054)).toBe(10.05);
    });
  });

  describe('lineTotal', () => {
    it('price × quantity is exact', () => {
      expect(lineTotal(0.1, 3)).toBe(0.3); // plain 0.1*3 === 0.30000000000000004
      expect(lineTotal(17.99, 3)).toBe(53.97);
      expect(lineTotal(19.99, 7)).toBe(139.93);
    });

    it('truncates fractional quantities defensively', () => {
      expect(lineTotal(10, 2.9)).toBe(20);
    });
  });

  describe('sumMoney', () => {
    it('0.1 + 0.2 === 0.30 (not 0.30000000000000004)', () => {
      expect(sumMoney([0.1, 0.2])).toBe(0.3);
    });

    it('does not drift over a long invoice', () => {
      const lines = Array.from({ length: 1000 }, () => 0.01);
      expect(sumMoney(lines)).toBe(10);
      // naive float reduce drifts here:
      expect(lines.reduce((s, x) => s + x, 0)).not.toBe(10);
    });

    it('sums mixed realistic amounts exactly', () => {
      expect(sumMoney([17.99, 53.97, 139.93, 0.01])).toBe(211.9);
    });
  });

  describe('addMoney / subtractMoney', () => {
    it('partial refunds chain exactly to the last kopeck', () => {
      // 100.00 − 33.33 − 33.33 must leave exactly 33.34
      const afterFirst = subtractMoney(100, 33.33);
      const afterSecond = subtractMoney(afterFirst, 33.33);
      expect(afterSecond).toBe(33.34);
    });

    it('addMoney is exact', () => {
      expect(addMoney(33.33, 66.67)).toBe(100);
      expect(addMoney(0.1, 0.2)).toBe(0.3);
    });
  });

  describe('percentOf', () => {
    it('rounds the discount to the nearest kopeck', () => {
      expect(percentOf(100.5, 10)).toBe(10.05);
      expect(percentOf(100.55, 10)).toBe(10.06); // 1005.5 → 1006
      expect(percentOf(100.54, 10)).toBe(10.05); // 1005.4 → 1005
    });

    it('handles fractional percent', () => {
      expect(percentOf(200, 8.5)).toBe(17);
    });

    it('0% and 100%', () => {
      expect(percentOf(123.45, 0)).toBe(0);
      expect(percentOf(123.45, 100)).toBe(123.45);
    });
  });

  describe('compareMoney', () => {
    it('treats kopeck-equal values as equal despite float tails', () => {
      expect(compareMoney(0.1 + 0.2, 0.3)).toBe(0);
      expect(compareMoney(100, 99.99)).toBe(1);
      expect(compareMoney(99.99, 100)).toBe(-1);
    });
  });

  describe('minMoney / maxMoney / clampMoney', () => {
    it('min and max are kopeck-exact', () => {
      expect(minMoney(10.05, 10.06, 9.99)).toBe(9.99);
      expect(maxMoney(10.05, 10.06, 9.99)).toBe(10.06);
    });

    it('clamp keeps a value inside [lo, hi]', () => {
      expect(clampMoney(150, 0, 100)).toBe(100);
      expect(clampMoney(-5, 0, 100)).toBe(0);
      expect(clampMoney(42.5, 0, 100)).toBe(42.5);
    });
  });
});
