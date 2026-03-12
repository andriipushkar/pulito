import { describe, it, expect } from 'vitest';
import { createReturnSchema, processReturnSchema } from './return-request';

describe('createReturnSchema', () => {
  const validReturn = {
    orderId: 1,
    reason: 'defective' as const,
    items: [{ orderItemId: 100, quantity: 1 }],
  };

  it('should accept valid return data', () => {
    const result = createReturnSchema.safeParse(validReturn);
    expect(result.success).toBe(true);
  });

  it('should accept valid data with optional description', () => {
    const result = createReturnSchema.safeParse({ ...validReturn, description: 'Товар зламаний' });
    expect(result.success).toBe(true);
  });

  it('should accept all valid reason types', () => {
    for (const reason of ['defective', 'wrong_item', 'not_as_described', 'changed_mind', 'damaged_delivery', 'other']) {
      const result = createReturnSchema.safeParse({ ...validReturn, reason });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid reason', () => {
    const result = createReturnSchema.safeParse({ ...validReturn, reason: 'too_expensive' });
    expect(result.success).toBe(false);
  });

  it('should reject missing items', () => {
    const { items, ...noItems } = validReturn;
    expect(createReturnSchema.safeParse(noItems).success).toBe(false);
  });

  it('should reject empty items array', () => {
    const result = createReturnSchema.safeParse({ ...validReturn, items: [] });
    expect(result.success).toBe(false);
  });

  it('should reject non-positive orderItemId', () => {
    const result = createReturnSchema.safeParse({
      ...validReturn,
      items: [{ orderItemId: 0, quantity: 1 }],
    });
    expect(result.success).toBe(false);
  });

  it('should reject non-positive quantity', () => {
    const result = createReturnSchema.safeParse({
      ...validReturn,
      items: [{ orderItemId: 100, quantity: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it('should reject non-integer orderId', () => {
    const result = createReturnSchema.safeParse({ ...validReturn, orderId: 1.5 });
    expect(result.success).toBe(false);
  });

  it('should reject description over 2000 characters', () => {
    const result = createReturnSchema.safeParse({ ...validReturn, description: 'x'.repeat(2001) });
    expect(result.success).toBe(false);
  });
});

describe('processReturnSchema', () => {
  it('should accept approved status', () => {
    const result = processReturnSchema.safeParse({ status: 'approved' });
    expect(result.success).toBe(true);
  });

  it('should accept rejected status', () => {
    const result = processReturnSchema.safeParse({ status: 'rejected' });
    expect(result.success).toBe(true);
  });

  it('should accept status with optional adminComment', () => {
    const result = processReturnSchema.safeParse({ status: 'approved', adminComment: 'Підтверджено' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid status', () => {
    const result = processReturnSchema.safeParse({ status: 'pending' });
    expect(result.success).toBe(false);
  });

  it('should reject missing status', () => {
    const result = processReturnSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should reject adminComment over 1000 characters', () => {
    const result = processReturnSchema.safeParse({ status: 'rejected', adminComment: 'x'.repeat(1001) });
    expect(result.success).toBe(false);
  });
});
