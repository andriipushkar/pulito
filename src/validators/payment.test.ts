import { describe, it, expect } from 'vitest';
import { initiatePaymentSchema } from './payment';

describe('initiatePaymentSchema', () => {
  it('should accept liqpay', () => {
    const result = initiatePaymentSchema.parse({ provider: 'liqpay' });
    expect(result.provider).toBe('liqpay');
  });

  it('should accept monobank', () => {
    const result = initiatePaymentSchema.parse({ provider: 'monobank' });
    expect(result.provider).toBe('monobank');
  });

  it('should reject unknown provider', () => {
    const result = initiatePaymentSchema.safeParse({ provider: 'stripe' });
    expect(result.success).toBe(false);
  });

  it('should reject missing provider', () => {
    const result = initiatePaymentSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
