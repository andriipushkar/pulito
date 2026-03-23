import { describe, it, expect } from 'vitest';
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
} from './subscription';

describe('subscription validators', () => {
  describe('createSubscriptionSchema', () => {
    const validData = {
      frequency: 'monthly' as const,
      items: [{ productId: 1, quantity: 2 }],
    };

    it('should accept valid data with required fields', () => {
      const result = createSubscriptionSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept all valid frequencies', () => {
      const freqs = ['weekly', 'biweekly', 'monthly', 'bimonthly'] as const;
      for (const frequency of freqs) {
        const result = createSubscriptionSchema.safeParse({ ...validData, frequency });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid frequency', () => {
      const result = createSubscriptionSchema.safeParse({ ...validData, frequency: 'daily' });
      expect(result.success).toBe(false);
    });

    it('should reject empty items array', () => {
      const result = createSubscriptionSchema.safeParse({ ...validData, items: [] });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('хоча б один товар');
      }
    });

    it('should reject items with quantity less than 1', () => {
      const result = createSubscriptionSchema.safeParse({
        ...validData,
        items: [{ productId: 1, quantity: 0 }],
      });
      expect(result.success).toBe(false);
    });

    it('should reject items with non-positive productId', () => {
      const result = createSubscriptionSchema.safeParse({
        ...validData,
        items: [{ productId: 0, quantity: 1 }],
      });
      expect(result.success).toBe(false);
    });

    it('should accept optional delivery fields', () => {
      const result = createSubscriptionSchema.safeParse({
        ...validData,
        deliveryMethod: 'nova_poshta',
        deliveryCity: 'Kyiv',
        deliveryAddress: 'Some address',
        paymentMethod: 'card',
      });
      expect(result.success).toBe(true);
    });

    it('should accept multiple items', () => {
      const result = createSubscriptionSchema.safeParse({
        ...validData,
        items: [
          { productId: 1, quantity: 2 },
          { productId: 2, quantity: 5 },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing frequency', () => {
      const result = createSubscriptionSchema.safeParse({ items: [{ productId: 1, quantity: 1 }] });
      expect(result.success).toBe(false);
    });

    it('should reject missing items', () => {
      const result = createSubscriptionSchema.safeParse({ frequency: 'monthly' });
      expect(result.success).toBe(false);
    });
  });

  describe('updateSubscriptionSchema', () => {
    it('should accept partial data', () => {
      const result = updateSubscriptionSchema.safeParse({ frequency: 'weekly' });
      expect(result.success).toBe(true);
    });

    it('should accept empty object', () => {
      const result = updateSubscriptionSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept status updates', () => {
      const result = updateSubscriptionSchema.safeParse({ status: 'paused' });
      expect(result.success).toBe(true);
    });

    it('should accept all valid statuses', () => {
      for (const status of ['active', 'paused', 'cancelled']) {
        const result = updateSubscriptionSchema.safeParse({ status });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid status', () => {
      const result = updateSubscriptionSchema.safeParse({ status: 'deleted' });
      expect(result.success).toBe(false);
    });

    it('should validate items when provided', () => {
      const result = updateSubscriptionSchema.safeParse({ items: [] });
      expect(result.success).toBe(false);
    });

    it('should accept updating delivery info', () => {
      const result = updateSubscriptionSchema.safeParse({
        deliveryCity: 'Lviv',
        deliveryAddress: 'New address',
      });
      expect(result.success).toBe(true);
    });
  });
});
