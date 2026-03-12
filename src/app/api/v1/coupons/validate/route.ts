import { NextRequest } from 'next/server';
import { withOptionalAuth } from '@/middleware/auth';
import { validateCoupon, calculateDiscount, CouponError } from '@/services/coupon';
import { applyCouponSchema } from '@/validators/coupon';
import { successResponse, errorResponse } from '@/utils/api-response';

export const POST = withOptionalAuth(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = applyCouponSchema.safeParse(body);
    if (!parsed.success) return errorResponse('Введіть промокод', 422);

    const orderAmount = Number(body.orderAmount) || 0;
    const coupon = await validateCoupon(parsed.data.code, user?.id, orderAmount);
    const discount = calculateDiscount(coupon, orderAmount);

    return successResponse({
      couponId: coupon.id,
      code: coupon.code,
      type: coupon.type,
      discount: Math.round(discount * 100) / 100,
      description: coupon.description,
    });
  } catch (error) {
    if (error instanceof CouponError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Помилка сервера', 500);
  }
});
