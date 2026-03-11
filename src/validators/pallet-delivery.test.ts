import { describe, it, expect } from 'vitest';
import { palletConfigSchema, calculatePalletCostSchema } from './pallet-delivery';

describe('palletConfigSchema', () => {
  it('should apply defaults', () => {
    const result = palletConfigSchema.parse({});
    expect(result.enabled).toBe(true);
    expect(result.minWeightKg).toBe(100);
    expect(result.maxWeightKg).toBe(5000);
    expect(result.basePrice).toBe(1500);
    expect(result.pricePerKg).toBe(3);
    expect(result.regions).toEqual([]);
    expect(result.estimatedDays).toBe('3-5');
  });

  it('should accept custom config', () => {
    const result = palletConfigSchema.parse({
      enabled: false,
      minWeightKg: 50,
      basePrice: 2000,
      regions: [{ name: 'Київ', multiplier: 0.8 }],
    });
    expect(result.enabled).toBe(false);
    expect(result.regions).toHaveLength(1);
  });

  it('should reject multiplier out of range', () => {
    const result = palletConfigSchema.safeParse({
      regions: [{ name: 'Test', multiplier: 15 }],
    });
    expect(result.success).toBe(false);
  });
});

describe('calculatePalletCostSchema', () => {
  it('should accept valid input', () => {
    const result = calculatePalletCostSchema.parse({ weightKg: 200 });
    expect(result.weightKg).toBe(200);
  });

  it('should reject weight < 1', () => {
    const result = calculatePalletCostSchema.safeParse({ weightKg: 0 });
    expect(result.success).toBe(false);
  });

  it('should accept optional region', () => {
    const result = calculatePalletCostSchema.parse({ weightKg: 100, region: 'Київ' });
    expect(result.region).toBe('Київ');
  });
});
