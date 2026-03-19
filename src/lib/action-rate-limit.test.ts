import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn((name: string) => {
      if (name === 'x-forwarded-for') return '1.2.3.4';
      return null;
    }),
  }),
}));

vi.mock('@/services/rate-limit', () => ({
  checkRateLimit: vi.fn(),
}));

import { checkActionRateLimit, ACTION_LIMITS } from './action-rate-limit';
import { checkRateLimit } from '@/services/rate-limit';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkActionRateLimit', () => {
  it('returns null when request is allowed', async () => {
    (checkRateLimit as ReturnType<typeof vi.fn>).mockResolvedValue({
      allowed: true,
      remaining: 4,
      retryAfter: 0,
    });

    const result = await checkActionRateLimit(ACTION_LIMITS.checkout);
    expect(result).toBeNull();
    expect(checkRateLimit).toHaveBeenCalledWith('1.2.3.4', ACTION_LIMITS.checkout);
  });

  it('returns error message when rate limited', async () => {
    (checkRateLimit as ReturnType<typeof vi.fn>).mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfter: 30,
    });

    const result = await checkActionRateLimit(ACTION_LIMITS.checkout);
    expect(result).toContain('Забагато запитів');
  });

  it('allows request when Redis is down', async () => {
    (checkRateLimit as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Redis connection failed'));

    const result = await checkActionRateLimit(ACTION_LIMITS.cart);
    expect(result).toBeNull();
  });

  it('uses correct presets', () => {
    expect(ACTION_LIMITS.checkout.max).toBe(5);
    expect(ACTION_LIMITS.cart.max).toBe(30);
    expect(ACTION_LIMITS.review.max).toBe(5);
    expect(ACTION_LIMITS.review.windowSec).toBe(900);
  });
});
