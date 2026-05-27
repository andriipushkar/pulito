import { prisma } from '@/lib/prisma';

export interface CreateReviewData {
  productId: number;
  userId: number;
  rating: number;
  title?: string;
  comment?: string;
  pros?: string;
  cons?: string;
  images?: string[];
}

export async function createReview(data: CreateReviewData) {
  // Check if user has purchased this product (verified purchase)
  const hasPurchased = await prisma.orderItem.findFirst({
    where: {
      productId: data.productId,
      order: {
        userId: data.userId,
        status: { in: ['completed', 'shipped'] },
      },
    },
  });

  return prisma.review.create({
    data: {
      ...data,
      isVerifiedPurchase: !!hasPurchased,
    },
    include: {
      user: { select: { id: true, fullName: true, avatarUrl: true } },
    },
  });
}

export async function getProductReviews(
  productId: number,
  page = 1,
  limit = 10,
  sort: 'newest' | 'helpful' | 'rating_high' | 'rating_low' = 'newest',
) {
  const orderBy =
    sort === 'helpful'
      ? { helpfulCount: 'desc' as const }
      : sort === 'rating_high'
        ? { rating: 'desc' as const }
        : sort === 'rating_low'
          ? { rating: 'asc' as const }
          : { createdAt: 'desc' as const };

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: { productId, status: 'approved' },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true } },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.review.count({ where: { productId, status: 'approved' } }),
  ]);

  return { reviews, total };
}

export async function getProductRatingStats(productId: number) {
  // Single groupBy aggregates count per rating bucket — avoids loading every
  // review row into memory just to count stars. Cheap even with thousands of
  // reviews because Postgres aggregates server-side.
  const groups = await prisma.review.groupBy({
    by: ['rating'],
    where: { productId, status: 'approved' },
    _count: { rating: true },
  });

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalReviews = 0;
  let weightedSum = 0;
  for (const g of groups) {
    const n = g._count.rating;
    distribution[g.rating] = n;
    totalReviews += n;
    weightedSum += g.rating * n;
  }

  if (totalReviews === 0) {
    return { averageRating: 0, totalReviews: 0, distribution };
  }

  return {
    averageRating: Math.round((weightedSum / totalReviews) * 10) / 10,
    totalReviews,
    distribution,
  };
}

export async function markReviewHelpful(reviewId: number) {
  return prisma.review.update({
    where: { id: reviewId },
    data: { helpfulCount: { increment: 1 } },
  });
}

export async function moderateReview(reviewId: number, status: 'approved' | 'rejected') {
  return prisma.review.update({
    where: { id: reviewId },
    data: { status },
  });
}

export async function replyToReview(reviewId: number, adminReply: string) {
  return prisma.review.update({
    where: { id: reviewId },
    data: { adminReply, adminReplyAt: new Date() },
  });
}

export async function getReviewsForModeration(page = 1, limit = 20, status?: string) {
  const where = status ? { status: status as 'pending' | 'approved' | 'rejected' } : {};

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        product: { select: { id: true, name: true, slug: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.review.count({ where }),
  ]);

  return { reviews, total };
}

export async function deleteReview(reviewId: number) {
  return prisma.review.delete({ where: { id: reviewId } });
}
