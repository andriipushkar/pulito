import { describe, it, expect } from 'vitest';
import { createReviewSchema, moderateReviewSchema, replyReviewSchema } from './review';

describe('createReviewSchema', () => {
  const validReview = {
    productId: 1,
    rating: 5,
    title: 'Чудовий товар',
    comment: 'Все сподобалось',
    pros: 'Якість',
    cons: 'Ціна',
  };

  it('should accept valid data', () => {
    const result = createReviewSchema.safeParse(validReview);
    expect(result.success).toBe(true);
  });

  it('should accept minimal data (only productId and rating)', () => {
    const result = createReviewSchema.safeParse({ productId: 1, rating: 3 });
    expect(result.success).toBe(true);
  });

  it('should reject rating 0', () => {
    expect(createReviewSchema.safeParse({ productId: 1, rating: 0 }).success).toBe(false);
  });

  it('should reject rating 6', () => {
    expect(createReviewSchema.safeParse({ productId: 1, rating: 6 }).success).toBe(false);
  });

  it('should reject negative rating', () => {
    expect(createReviewSchema.safeParse({ productId: 1, rating: -1 }).success).toBe(false);
  });

  it('should reject non-integer rating', () => {
    expect(createReviewSchema.safeParse({ productId: 1, rating: 3.5 }).success).toBe(false);
  });

  it('should reject missing productId', () => {
    expect(createReviewSchema.safeParse({ rating: 5 }).success).toBe(false);
  });

  it('should reject missing rating', () => {
    expect(createReviewSchema.safeParse({ productId: 1 }).success).toBe(false);
  });

  it('should reject non-positive productId', () => {
    expect(createReviewSchema.safeParse({ productId: 0, rating: 5 }).success).toBe(false);
    expect(createReviewSchema.safeParse({ productId: -1, rating: 5 }).success).toBe(false);
  });

  it('should reject title longer than 200 characters', () => {
    const result = createReviewSchema.safeParse({
      productId: 1,
      rating: 5,
      title: 'a'.repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it('should reject comment longer than 2000 characters', () => {
    const result = createReviewSchema.safeParse({
      productId: 1,
      rating: 5,
      comment: 'a'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it('should reject pros longer than 500 characters', () => {
    const result = createReviewSchema.safeParse({
      productId: 1,
      rating: 5,
      pros: 'a'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('should reject cons longer than 500 characters', () => {
    const result = createReviewSchema.safeParse({
      productId: 1,
      rating: 5,
      cons: 'a'.repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe('moderateReviewSchema', () => {
  it('should accept approved status', () => {
    const result = moderateReviewSchema.safeParse({ status: 'approved' });
    expect(result.success).toBe(true);
  });

  it('should accept rejected status', () => {
    const result = moderateReviewSchema.safeParse({ status: 'rejected' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid status', () => {
    expect(moderateReviewSchema.safeParse({ status: 'pending' }).success).toBe(false);
    expect(moderateReviewSchema.safeParse({ status: 'deleted' }).success).toBe(false);
    expect(moderateReviewSchema.safeParse({ status: '' }).success).toBe(false);
  });

  it('should reject missing status', () => {
    expect(moderateReviewSchema.safeParse({}).success).toBe(false);
  });
});

describe('replyReviewSchema', () => {
  it('should accept valid reply', () => {
    const result = replyReviewSchema.safeParse({ adminReply: 'Дякуємо за відгук!' });
    expect(result.success).toBe(true);
  });

  it('should reject empty reply', () => {
    expect(replyReviewSchema.safeParse({ adminReply: '' }).success).toBe(false);
  });

  it('should reject reply longer than 1000 characters', () => {
    const result = replyReviewSchema.safeParse({ adminReply: 'a'.repeat(1001) });
    expect(result.success).toBe(false);
  });

  it('should reject missing adminReply', () => {
    expect(replyReviewSchema.safeParse({}).success).toBe(false);
  });
});
