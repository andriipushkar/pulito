import { describe, it, expect } from 'vitest';
import { deliveryEstimateSchema } from './delivery';

describe('deliveryEstimateSchema', () => {
  it('should accept nova_poshta', () => {
    const result = deliveryEstimateSchema.parse({
      method: 'nova_poshta',
      total: 500,
    });
    expect(result.method).toBe('nova_poshta');
    expect(result.weight).toBe(1); // default
  });

  it('should accept ukrposhta', () => {
    const result = deliveryEstimateSchema.parse({
      method: 'ukrposhta',
      total: 300,
      weight: 2.5,
    });
    expect(result.weight).toBe(2.5);
  });

  it('should reject invalid method', () => {
    const result = deliveryEstimateSchema.safeParse({
      method: 'dhl',
      total: 100,
    });
    expect(result.success).toBe(false);
  });

  it('should reject weight below 0.1', () => {
    const result = deliveryEstimateSchema.safeParse({
      method: 'nova_poshta',
      total: 100,
      weight: 0.05,
    });
    expect(result.success).toBe(false);
  });
});
