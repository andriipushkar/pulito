import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { getProductReviews, getProductRatingStats, createReview } from '@/services/review';
import { createReviewSchema } from '@/validators/review';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { successResponse, errorResponse } from '@/utils/api-response';

function clampPositiveInt(raw: string | null, fallback: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const productId = Number(slug);
    if (!Number.isFinite(productId) || productId <= 0)
      return errorResponse('Невірний ID товару', 400);

    const url = new URL(request.url);
    const page = clampPositiveInt(url.searchParams.get('page'), 1, 1000);
    const limit = clampPositiveInt(url.searchParams.get('limit'), 10, 50);
    const sortRaw = url.searchParams.get('sort') || 'newest';
    const sort = (
      ['newest', 'helpful', 'rating_high', 'rating_low'].includes(sortRaw) ? sortRaw : 'newest'
    ) as 'newest' | 'helpful' | 'rating_high' | 'rating_low';

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
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.reviews);
    if (!rl.allowed) return errorResponse('Забагато відгуків. Спробуйте пізніше.', 429);

    const { slug } = await params!;
    const productId = Number(slug);
    if (!Number.isFinite(productId) || productId <= 0)
      return errorResponse('Невірний ID товару', 400);

    const body = await request.json();
    const parsed = createReviewSchema.safeParse({ ...body, productId });
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const review = await createReview({ ...parsed.data, userId: user.id });
    await logAudit({
      userId: user.id,
      actionType: 'data_create',
      entityType: 'review',
      entityId: review.id,
      details: { productId, rating: parsed.data.rating },
      ipAddress: getClientIp(request),
    });
    return successResponse(review, 201);
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return errorResponse('Ви вже залишали відгук на цей товар', 409);
    }
    return errorResponse('Помилка сервера', 500);
  }
});
