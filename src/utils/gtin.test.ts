import { describe, it, expect } from 'vitest';
import { gs1CheckDigit, isValidGtin, gtinValidationError } from './gtin';

describe('gs1CheckDigit', () => {
  // Each pair: [payload (without check), expected check digit]
  // Verified against publicly-known GTINs.
  it.each([
    ['590123412345', 7], // EAN-13: 5901234123457 — GS1 sample
    ['544900000099', 6], // EAN-13: 5449000000996 — Coca-Cola
    ['0123456', 5], // EAN-8: 01234565
    ['03600029145', 2], // UPC-A: 036000291452 — Plain M&M's
  ])('computes check digit %s → %d', (payload, expected) => {
    expect(gs1CheckDigit(payload)).toBe(expected);
  });
});

describe('isValidGtin', () => {
  it('accepts valid EAN-13', () => {
    expect(isValidGtin('5901234123457')).toBe(true);
    expect(isValidGtin('5449000000996')).toBe(true);
  });

  it('accepts valid UPC-A', () => {
    expect(isValidGtin('036000291452')).toBe(true);
  });

  it('accepts valid EAN-8', () => {
    expect(isValidGtin('01234565')).toBe(true);
  });

  it('rejects wrong check digit', () => {
    expect(isValidGtin('5901234123450')).toBe(false);
    expect(isValidGtin('5449000000991')).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(isValidGtin('')).toBe(false);
    expect(isValidGtin(null)).toBe(false);
    expect(isValidGtin(undefined)).toBe(false);
    expect(isValidGtin('abc')).toBe(false);
    expect(isValidGtin('1234567')).toBe(false); // 7 digits — not a valid GTIN length
    expect(isValidGtin('12345678901')).toBe(false); // 11 digits
    expect(isValidGtin('123456789012345')).toBe(false); // 15 digits
    expect(isValidGtin('5901234 123457')).toBe(false); // contains space
  });
});

describe('gtinValidationError', () => {
  it('returns null for empty input (treated as optional)', () => {
    expect(gtinValidationError('')).toBeNull();
    expect(gtinValidationError('   ')).toBeNull();
  });

  it('returns null for valid GTINs', () => {
    expect(gtinValidationError('5901234123457')).toBeNull();
    expect(gtinValidationError('036000291452')).toBeNull();
  });

  it('explains non-digit input', () => {
    expect(gtinValidationError('590123412345a')).toMatch(/лише цифри/);
  });

  it('explains wrong length', () => {
    expect(gtinValidationError('1234567')).toMatch(/8, 12, 13 або 14/);
    expect(gtinValidationError('12345678901')).toMatch(/8, 12, 13 або 14/);
  });

  it('explains wrong check digit with the expected value', () => {
    const err = gtinValidationError('5901234123450');
    expect(err).toMatch(/правильна має бути 7/);
    expect(err).toMatch(/введено 0/);
  });
});
