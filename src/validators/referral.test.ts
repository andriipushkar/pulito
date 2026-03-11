import { describe, it, expect } from 'vitest';
import { referralFilterSchema, grantBonusSchema } from './referral';

describe('referralFilterSchema', () => {
  it('should apply defaults', () => {
    const result = referralFilterSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('should accept all filters', () => {
    const result = referralFilterSchema.parse({
      page: 2,
      limit: 10,
      status: 'first_order',
      referrerId: 5,
    });
    expect(result.status).toBe('first_order');
    expect(result.referrerId).toBe(5);
  });

  it('should reject invalid status', () => {
    const result = referralFilterSchema.safeParse({ status: 'invalid' });
    expect(result.success).toBe(false);
  });
});

describe('grantBonusSchema', () => {
  it('should accept valid bonus', () => {
    const result = grantBonusSchema.parse({
      bonusType: 'discount',
      bonusValue: 100,
    });
    expect(result.bonusType).toBe('discount');
  });

  it('should accept all bonus types', () => {
    for (const type of ['discount', 'cashback', 'points']) {
      expect(grantBonusSchema.safeParse({ bonusType: type, bonusValue: 10 }).success).toBe(true);
    }
  });

  it('should reject zero bonusValue', () => {
    const result = grantBonusSchema.safeParse({ bonusType: 'discount', bonusValue: 0 });
    expect(result.success).toBe(false);
  });

  it('should reject negative bonusValue', () => {
    const result = grantBonusSchema.safeParse({ bonusType: 'discount', bonusValue: -10 });
    expect(result.success).toBe(false);
  });
});
