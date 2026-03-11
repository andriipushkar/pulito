import { describe, it, expect } from 'vitest';
import {
  adjustPointsSchema,
  updateLoyaltyLevelSchema,
  loyaltyTransactionFilterSchema,
} from './loyalty';

describe('adjustPointsSchema', () => {
  it('should validate correct manual_add', () => {
    const result = adjustPointsSchema.safeParse({
      userId: 1,
      type: 'manual_add',
      points: 100,
      description: 'Бонус за відгук',
    });
    expect(result.success).toBe(true);
  });

  it('should validate manual_deduct', () => {
    const result = adjustPointsSchema.safeParse({
      userId: 1,
      type: 'manual_deduct',
      points: 50,
      description: 'Корекція',
    });
    expect(result.success).toBe(true);
  });

  it('should reject zero points', () => {
    const result = adjustPointsSchema.safeParse({
      userId: 1,
      type: 'manual_add',
      points: 0,
      description: 'Test',
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative userId', () => {
    const result = adjustPointsSchema.safeParse({
      userId: -1,
      type: 'manual_add',
      points: 10,
      description: 'Test',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty description', () => {
    const result = adjustPointsSchema.safeParse({
      userId: 1,
      type: 'manual_add',
      points: 10,
      description: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateLoyaltyLevelSchema', () => {
  it('should validate correct level', () => {
    const result = updateLoyaltyLevelSchema.safeParse({
      name: 'gold',
      minSpent: 5000,
      pointsMultiplier: 2,
      discountPercent: 5,
      sortOrder: 2,
    });
    expect(result.success).toBe(true);
  });

  it('should apply defaults', () => {
    const result = updateLoyaltyLevelSchema.parse({
      name: 'bronze',
      minSpent: 0,
    });
    expect(result.pointsMultiplier).toBe(1);
    expect(result.discountPercent).toBe(0);
    expect(result.sortOrder).toBe(0);
  });

  it('should reject discountPercent > 100', () => {
    const result = updateLoyaltyLevelSchema.safeParse({
      name: 'test',
      minSpent: 0,
      discountPercent: 150,
    });
    expect(result.success).toBe(false);
  });
});

describe('loyaltyTransactionFilterSchema', () => {
  it('should apply defaults', () => {
    const result = loyaltyTransactionFilterSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('should reject limit > 100', () => {
    const result = loyaltyTransactionFilterSchema.safeParse({ limit: 200 });
    expect(result.success).toBe(false);
  });
});
