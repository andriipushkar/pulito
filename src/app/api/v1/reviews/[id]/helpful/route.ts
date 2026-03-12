import { NextRequest } from 'next/server';
import { markReviewHelpful } from '@/services/review';
import { successResponse, errorResponse } from '@/utils/api-response';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const reviewId = Number(id);
    if (!reviewId) return errorResponse('Невірний ID', 400);

    await markReviewHelpful(reviewId);
    return successResponse({ success: true });
  } catch {
    return errorResponse('Помилка сервера', 500);
  }
}
