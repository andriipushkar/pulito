import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

/**
 * Returns external (Rozetka/Prom) reviews for a product, ordered newest first.
 * Used by ProductPage to render social proof from marketplace shoppers next to
 * local user Reviews.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const params = await context.params;
  const slug = params.slug;
  if (!slug) return errorResponse('Invalid slug', 400);

  const product = await prisma.product.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!product) return errorResponse('Product not found', 404);

  const reviews = await prisma.marketplaceReview.findMany({
    where: { productId: product.id },
    orderBy: { reviewedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      platform: true,
      authorName: true,
      rating: true,
      title: true,
      comment: true,
      pros: true,
      cons: true,
      reviewedAt: true,
      permalink: true,
    },
  });

  return successResponse({ reviews });
}
