import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockPrismaClient } from '@/test/prisma-mock';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    review: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    orderItem: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import {
  createReview,
  getProductReviews,
  getProductRatingStats,
  markReviewHelpful,
  moderateReview,
  replyToReview,
  getReviewsForModeration,
  deleteReview,
} from '@/services/review';

const mockPrisma = prisma as unknown as MockPrismaClient;

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// createReview
// ---------------------------------------------------------------------------

describe('createReview', () => {
  const reviewData = {
    productId: 1,
    userId: 10,
    rating: 5,
    title: 'Чудовий товар',
    comment: 'Все сподобалось',
  };

  it('creates review with verified purchase when user has purchased the product', async () => {
    mockPrisma.orderItem.findFirst.mockResolvedValue({ id: 1 });
    mockPrisma.review.create.mockResolvedValue({
      id: 1,
      ...reviewData,
      isVerifiedPurchase: true,
      user: { id: 10, fullName: 'Тест Юзер', avatarUrl: null },
    });

    const result = await createReview(reviewData);

    expect(mockPrisma.orderItem.findFirst).toHaveBeenCalledWith({
      where: {
        productId: 1,
        order: {
          userId: 10,
          status: { in: ['completed', 'shipped'] },
        },
      },
    });
    expect(mockPrisma.review.create).toHaveBeenCalledWith({
      data: { ...reviewData, isVerifiedPurchase: true },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });
    expect(result.isVerifiedPurchase).toBe(true);
  });

  it('creates review without verified purchase when user has not purchased', async () => {
    mockPrisma.orderItem.findFirst.mockResolvedValue(null);
    mockPrisma.review.create.mockResolvedValue({
      id: 2,
      ...reviewData,
      isVerifiedPurchase: false,
      user: { id: 10, fullName: 'Тест Юзер', avatarUrl: null },
    });

    const result = await createReview(reviewData);

    expect(mockPrisma.review.create).toHaveBeenCalledWith({
      data: { ...reviewData, isVerifiedPurchase: false },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });
    expect(result.isVerifiedPurchase).toBe(false);
  });

  it('throws on duplicate review (unique constraint P2002)', async () => {
    mockPrisma.orderItem.findFirst.mockResolvedValue(null);
    const prismaError = new Error('Unique constraint failed');
    (prismaError as any).code = 'P2002';
    mockPrisma.review.create.mockRejectedValue(prismaError);

    await expect(createReview(reviewData)).rejects.toThrow('Unique constraint failed');
  });
});

// ---------------------------------------------------------------------------
// getProductReviews
// ---------------------------------------------------------------------------

describe('getProductReviews', () => {
  it('returns paginated reviews with default params', async () => {
    const mockReviews = [{ id: 1, rating: 5 }];
    mockPrisma.review.findMany.mockResolvedValue(mockReviews);
    mockPrisma.review.count.mockResolvedValue(1);

    const result = await getProductReviews(1);

    expect(mockPrisma.review.findMany).toHaveBeenCalledWith({
      where: { productId: 1, status: 'approved' },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 10,
    });
    expect(mockPrisma.review.count).toHaveBeenCalledWith({
      where: { productId: 1, status: 'approved' },
    });
    expect(result).toEqual({ reviews: mockReviews, total: 1 });
  });

  it('applies pagination correctly', async () => {
    mockPrisma.review.findMany.mockResolvedValue([]);
    mockPrisma.review.count.mockResolvedValue(25);

    await getProductReviews(1, 3, 5);

    expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 5 })
    );
  });

  it('sorts by helpful count', async () => {
    mockPrisma.review.findMany.mockResolvedValue([]);
    mockPrisma.review.count.mockResolvedValue(0);

    await getProductReviews(1, 1, 10, 'helpful');

    expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { helpfulCount: 'desc' } })
    );
  });

  it('sorts by rating high', async () => {
    mockPrisma.review.findMany.mockResolvedValue([]);
    mockPrisma.review.count.mockResolvedValue(0);

    await getProductReviews(1, 1, 10, 'rating_high');

    expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { rating: 'desc' } })
    );
  });

  it('sorts by rating low', async () => {
    mockPrisma.review.findMany.mockResolvedValue([]);
    mockPrisma.review.count.mockResolvedValue(0);

    await getProductReviews(1, 1, 10, 'rating_low');

    expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { rating: 'asc' } })
    );
  });
});

// ---------------------------------------------------------------------------
// getProductRatingStats
// ---------------------------------------------------------------------------

describe('getProductRatingStats', () => {
  it('returns correct distribution and average', async () => {
    mockPrisma.review.findMany.mockResolvedValue([
      { rating: 5 },
      { rating: 5 },
      { rating: 4 },
      { rating: 3 },
      { rating: 1 },
    ]);

    const result = await getProductRatingStats(1);

    expect(result).toEqual({
      averageRating: 3.6,
      totalReviews: 5,
      distribution: { 1: 1, 2: 0, 3: 1, 4: 1, 5: 2 },
    });
  });

  it('returns zeroed stats when no reviews', async () => {
    mockPrisma.review.findMany.mockResolvedValue([]);

    const result = await getProductRatingStats(1);

    expect(result).toEqual({
      averageRating: 0,
      totalReviews: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });
  });
});

// ---------------------------------------------------------------------------
// markReviewHelpful
// ---------------------------------------------------------------------------

describe('markReviewHelpful', () => {
  it('increments helpful count', async () => {
    mockPrisma.review.update.mockResolvedValue({ id: 1, helpfulCount: 6 });

    const result = await markReviewHelpful(1);

    expect(mockPrisma.review.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { helpfulCount: { increment: 1 } },
    });
    expect(result.helpfulCount).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// moderateReview
// ---------------------------------------------------------------------------

describe('moderateReview', () => {
  it('approves a review', async () => {
    mockPrisma.review.update.mockResolvedValue({ id: 1, status: 'approved' });

    const result = await moderateReview(1, 'approved');

    expect(mockPrisma.review.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'approved' },
    });
    expect(result.status).toBe('approved');
  });

  it('rejects a review', async () => {
    mockPrisma.review.update.mockResolvedValue({ id: 1, status: 'rejected' });

    const result = await moderateReview(1, 'rejected');

    expect(mockPrisma.review.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'rejected' },
    });
    expect(result.status).toBe('rejected');
  });
});

// ---------------------------------------------------------------------------
// replyToReview
// ---------------------------------------------------------------------------

describe('replyToReview', () => {
  it('sets adminReply and adminReplyAt', async () => {
    const now = new Date();
    vi.useFakeTimers();
    vi.setSystemTime(now);

    mockPrisma.review.update.mockResolvedValue({
      id: 1,
      adminReply: 'Дякуємо за відгук!',
      adminReplyAt: now,
    });

    const result = await replyToReview(1, 'Дякуємо за відгук!');

    expect(mockPrisma.review.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { adminReply: 'Дякуємо за відгук!', adminReplyAt: now },
    });
    expect(result.adminReply).toBe('Дякуємо за відгук!');
    expect(result.adminReplyAt).toEqual(now);

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// getReviewsForModeration
// ---------------------------------------------------------------------------

describe('getReviewsForModeration', () => {
  it('returns all reviews without status filter', async () => {
    const mockReviews = [{ id: 1 }, { id: 2 }];
    mockPrisma.review.findMany.mockResolvedValue(mockReviews);
    mockPrisma.review.count.mockResolvedValue(2);

    const result = await getReviewsForModeration();

    expect(mockPrisma.review.findMany).toHaveBeenCalledWith({
      where: {},
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        product: { select: { id: true, name: true, slug: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    });
    expect(result).toEqual({ reviews: mockReviews, total: 2 });
  });

  it('filters by status when provided', async () => {
    mockPrisma.review.findMany.mockResolvedValue([]);
    mockPrisma.review.count.mockResolvedValue(0);

    await getReviewsForModeration(1, 20, 'pending');

    expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'pending' } })
    );
    expect(mockPrisma.review.count).toHaveBeenCalledWith({
      where: { status: 'pending' },
    });
  });

  it('applies pagination correctly', async () => {
    mockPrisma.review.findMany.mockResolvedValue([]);
    mockPrisma.review.count.mockResolvedValue(50);

    await getReviewsForModeration(3, 10);

    expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    );
  });
});

// ---------------------------------------------------------------------------
// deleteReview
// ---------------------------------------------------------------------------

describe('deleteReview', () => {
  it('deletes a review by id', async () => {
    mockPrisma.review.delete.mockResolvedValue({ id: 1 });

    const result = await deleteReview(1);

    expect(mockPrisma.review.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(result.id).toBe(1);
  });
});
