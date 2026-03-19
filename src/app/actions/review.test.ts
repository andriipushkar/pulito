import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/action-rate-limit', () => ({
  checkActionRateLimit: vi.fn().mockResolvedValue(null),
  ACTION_LIMITS: { review: { prefix: 'rl:action:review:', max: 5, windowSec: 900 } },
}));

vi.mock('@/services/review', () => ({
  createReview: vi.fn(),
  markReviewHelpful: vi.fn(),
}));

vi.mock('@/services/token', () => ({
  verifyAccessToken: vi.fn(),
}));

vi.mock('@/services/auth', () => ({
  isAccessTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: 'test-token' }),
  }),
}));

import { submitReviewAction, markHelpfulAction } from './review';
import { createReview, markReviewHelpful } from '@/services/review';
import { verifyAccessToken } from '@/services/token';
import { cookies } from 'next/headers';

beforeEach(() => {
  vi.clearAllMocks();
  (verifyAccessToken as ReturnType<typeof vi.fn>).mockReturnValue({
    sub: 1,
    email: 'test@test.com',
    role: 'user',
  });
});

describe('submitReviewAction', () => {
  it('submits a review for authenticated user', async () => {
    (createReview as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });

    const formData = new FormData();
    formData.set('productId', '10');
    formData.set('rating', '5');
    formData.set('title', 'Great product');
    formData.set('comment', 'Very good');

    const result = await submitReviewAction({ success: false }, formData);
    expect(result.success).toBe(true);
    expect(createReview).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 10, rating: 5, userId: 1 })
    );
  });

  it('returns error without auth', async () => {
    (cookies as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      get: vi.fn().mockReturnValue(undefined),
    });

    const formData = new FormData();
    formData.set('productId', '10');
    formData.set('rating', '5');

    const result = await submitReviewAction({ success: false }, formData);
    expect(result.success).toBe(false);
    expect(result.error).toContain('авторизуватися');
  });

  it('validates rating is required', async () => {
    const formData = new FormData();
    formData.set('productId', '10');
    formData.set('rating', '0');

    const result = await submitReviewAction({ success: false }, formData);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('handles duplicate review error', async () => {
    (createReview as ReturnType<typeof vi.fn>).mockRejectedValue({ code: 'P2002' });

    const formData = new FormData();
    formData.set('productId', '10');
    formData.set('rating', '5');

    const result = await submitReviewAction({ success: false }, formData);
    expect(result.success).toBe(false);
    expect(result.error).toContain('вже залишали');
  });
});

describe('markHelpfulAction', () => {
  it('marks review as helpful', async () => {
    (markReviewHelpful as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const result = await markHelpfulAction(5);
    expect(result.success).toBe(true);
    expect(markReviewHelpful).toHaveBeenCalledWith(5);
  });

  it('validates review ID', async () => {
    const result = await markHelpfulAction(0);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Невірний ID');
  });

  it('validates negative review ID', async () => {
    const result = await markHelpfulAction(-1);
    expect(result.success).toBe(false);
  });

  it('handles service errors', async () => {
    (markReviewHelpful as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'));

    const result = await markHelpfulAction(1);
    expect(result.success).toBe(false);
  });
});
