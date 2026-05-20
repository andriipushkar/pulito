import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { updateCoupon, deleteCoupon } from '@/services/coupon';
import { updateCouponSchema } from '@/validators/coupon';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

export const PATCH = withRole('admin')(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const couponId = Number(id);
    if (!couponId) return errorResponse('Невірний ID', 400);

    const body = await request.json();
    const parsed = updateCouponSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);

    const coupon = await updateCoupon(couponId, parsed.data);
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'coupon',
      entityId: couponId,
      details: { fields: Object.keys(parsed.data) },
    });
    return successResponse(coupon);
  } catch (err) {
    logger.error('[admin/coupons/[id]] PATCH failed', { error: err });
    return errorResponse('Помилка сервера', 500);
  }
});

export const DELETE = withRole('admin')(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const couponId = Number(id);
    if (!couponId) return errorResponse('Невірний ID', 400);
    await deleteCoupon(couponId);
    await logAudit({
      userId: user.id,
      actionType: 'data_delete',
      entityType: 'coupon',
      entityId: couponId,
    });
    return successResponse({ deleted: true });
  } catch (err) {
    logger.error('[admin/coupons/[id]] DELETE failed', { error: err });
    return errorResponse('Помилка сервера', 500);
  }
});
