import { describe, it, expect } from 'vitest';
import { currentKyivHour } from './promo-autopost';

describe('currentKyivHour', () => {
  it('returns 0–23 and normalises midnight (never 24)', () => {
    // 2026-06-02T21:00:00Z → Kyiv is UTC+3 in summer → 00:00 → hour 0, not 24.
    expect(currentKyivHour(new Date('2026-06-02T21:00:00Z'))).toBe(0);
    // 2026-06-02T08:00:00Z → Kyiv 11:00 → hour 11.
    expect(currentKyivHour(new Date('2026-06-02T08:00:00Z'))).toBe(11);
    // Always within range.
    const h = currentKyivHour(new Date('2026-01-15T23:30:00Z'));
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(23);
  });
});
