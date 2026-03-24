import { describe, it, expect } from 'vitest';
import { timingSafeCompare } from './timing-safe';

describe('timingSafeCompare', () => {
  it('returns true for identical strings', () => {
    expect(timingSafeCompare('abc123', 'abc123')).toBe(true);
  });

  it('returns false for different strings of same length', () => {
    expect(timingSafeCompare('abc123', 'abc124')).toBe(false);
  });

  it('returns false for different length strings', () => {
    expect(timingSafeCompare('short', 'longer-string')).toBe(false);
  });

  it('returns true for empty strings', () => {
    expect(timingSafeCompare('', '')).toBe(true);
  });

  it('returns false when one string is empty', () => {
    expect(timingSafeCompare('', 'notempty')).toBe(false);
  });

  it('handles special characters', () => {
    const token = 'a1b2c3!@#$%^&*()';
    expect(timingSafeCompare(token, token)).toBe(true);
    expect(timingSafeCompare(token, 'a1b2c3!@#$%^&*()')).toBe(true);
  });

  it('handles unicode strings', () => {
    expect(timingSafeCompare('Порошок', 'Порошок')).toBe(true);
    expect(timingSafeCompare('Порошок', 'порошок')).toBe(false);
  });

  it('compares hex tokens correctly', () => {
    const hex = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
    expect(timingSafeCompare(hex, hex)).toBe(true);
    expect(timingSafeCompare(hex, hex.slice(0, -1) + '0')).toBe(false);
  });
});
