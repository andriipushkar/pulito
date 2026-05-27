import { NextRequest } from 'next/server';
import { withOptionalAuth } from '@/middleware/auth';
import { validateCoupon, calculateDiscount, CouponError } from '@/services/coupon';
import { applyCouponSchema } from '@/validators/coupon';
import { successResponse, errorResponse } from '@/utils/api-response';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { getClientIp } from '@/utils/request';

export const POST = withOptionalAuth(async (request: NextRequest, { user }) => {
  try {
    // Public coupon-validate is the prime brute-force target — an attacker
    // who can hammer N codes/sec eventually discovers any short PROMO123-ish
    // pattern. The `sensitive` bucket (3/15min/IP) keeps legit checkout
    // (where the user types one code per cart) comfortable while shutting
    // down enumeration. Authenticated users get the same key by user id so
    // they can't bypass by rotating IPs through a botnet.
    const rlKey = user?.id ? `user:${user.id}` : getClientIp(request);
    const rl = await checkRateLimit(rlKey, RATE_LIMITS.couponValidate);
    if (!rl.allowed) {
      return errorResponse(`Забагато спроб промокода. Спробуйте через ${rl.retryAfter} с.`, 429);
    }
    const body = await request.json();
    const parsed = applyCouponSchema.safeParse(body);
    if (!parsed.success) return errorResponse('Введіть промокод', 422);

    const orderAmount = Number(body.orderAmount) || 0;
    // Cart product IDs allow the validator to enforce category/product
    // restrictions. Accept undefined for backwards-compat (clients without
    // cart context still get base validation).
    const cartProductIds = Array.isArray(body.cartProductIds)
      ? (body.cartProductIds as unknown[])
          .map((n) => Number(n))
          .filter((n) => Number.isFinite(n) && n > 0)
      : undefined;
    const coupon = await validateCoupon(parsed.data.code, user?.id, orderAmount, cartProductIds);
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
