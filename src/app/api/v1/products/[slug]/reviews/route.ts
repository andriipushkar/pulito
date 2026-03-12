import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { getProductReviews, getProductRatingStats, createReview } from '@/services/review';
import { createReviewSchema } from '@/validators/review';
import { successResponse, errorResponse } from '@/utils/api-response';

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const productId = Number(slug);
    if (!productId) return errorResponse('Невірний ID товару', 400);

    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page')) || 1;
    const limit = Math.min(Number(url.searchParams.get('limit')) || 10, 50);
    const sort = (url.searchParams.get('sort') || 'newest') as 'newest' | 'helpful' | 'rating_high' | 'rating_low';

    const [{ reviews, total }, stats] = await Promise.all([
      getProductReviews(productId, page, limit, sort),
      getProductRatingStats(productId),
    ]);

    return successResponse({ reviews, stats, total, page, limit });
  } catch {
    return errorResponse('Помилка сервера', 500);
  }
}

export const POST = withAuth(async (request: NextRequest, { user, params }) => {
  try {
    const { slug } = await params!;
    const productId = Number(slug);
    if (!productId) return errorResponse('Невірний ID товару', 400);

    const body = await request.json();
    const parsed = createReviewSchema.safeParse({ ...body, productId });
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const review = await createReview({ ...parsed.data, userId: user.id });
    return successResponse(review, 201);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return errorResponse('Ви вже залишали відгук на цей товар', 409);
    }
    return errorResponse('Помилка сервера', 500);
  }
});
