import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { updateCoupon, deleteCoupon } from '@/services/coupon';
import { updateCouponSchema } from '@/validators/coupon';
import { successResponse, errorResponse } from '@/utils/api-response';

export const PATCH = withRole('admin')(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const couponId = Number(id);
    if (!couponId) return errorResponse('Невірний ID', 400);

    const body = await request.json();
    const parsed = updateCouponSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);

    const coupon = await updateCoupon(couponId, parsed.data);
    return successResponse(coupon);
  } catch {
    return errorResponse('Помилка сервера', 500);
  }
});

export const DELETE = withRole('admin')(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const couponId = Number(id);
    if (!couponId) return errorResponse('Невірний ID', 400);
    await deleteCoupon(couponId);
    return successResponse({ deleted: true });
  } catch {
    return errorResponse('Помилка сервера', 500);
  }
});
