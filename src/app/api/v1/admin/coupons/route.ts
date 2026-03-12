import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getCoupons, createCoupon } from '@/services/coupon';
import { createCouponSchema } from '@/validators/coupon';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page')) || 1;
    const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100);
    const showExpired = url.searchParams.get('expired') === 'true';

    const { coupons, total } = await getCoupons(page, limit, showExpired);
    return successResponse({ coupons, total, page, limit });
  } catch {
    return errorResponse('Помилка сервера', 500);
  }
});

export const POST = withRole('admin')(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = createCouponSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const coupon = await createCoupon(parsed.data);
    return successResponse(coupon, 201);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return errorResponse('Промокод з таким кодом вже існує', 409);
    }
    return errorResponse('Помилка сервера', 500);
  }
});
