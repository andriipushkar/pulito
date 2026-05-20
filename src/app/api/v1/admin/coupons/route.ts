import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getCoupons, createCoupon } from '@/services/coupon';
import { createCouponSchema } from '@/validators/coupon';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/services/audit';

export const GET = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page')) || 1;
    const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100);
    const showExpired = url.searchParams.get('expired') === 'true';

    const { coupons, total } = await getCoupons(page, limit, showExpired);
    return successResponse({ coupons, total, page, limit });
  } catch (err) {
    logger.error('[admin/coupons] GET failed', { error: err });
    return errorResponse('Помилка сервера', 500);
  }
});

export const POST = withRole('admin')(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = createCouponSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    // Refuse coupons that reference categories/products which don't exist —
    // otherwise validateCoupon will silently never match the rule and admins
    // will think the discount is broken without an obvious reason.
    const data = parsed.data as typeof parsed.data & {
      applicableCategoryIds?: number[];
      excludedProductIds?: number[];
    };
    if (data.applicableCategoryIds?.length) {
      const found = await prisma.category.count({
        where: { id: { in: data.applicableCategoryIds }, deletedAt: null },
      });
      if (found !== data.applicableCategoryIds.length) {
        return errorResponse('Деякі категорії в applicableCategoryIds не існують', 400);
      }
    }
    if (data.excludedProductIds?.length) {
      const found = await prisma.product.count({
        where: { id: { in: data.excludedProductIds }, deletedAt: null },
      });
      if (found !== data.excludedProductIds.length) {
        return errorResponse('Деякі товари в excludedProductIds не існують', 400);
      }
    }

    const coupon = await createCoupon({ ...parsed.data, createdBy: user.id });
    await logAudit({
      userId: user.id,
      actionType: 'data_create',
      entityType: 'coupon',
      entityId: coupon.id,
      details: { code: coupon.code },
    });
    return successResponse(coupon, 201);
  } catch (error: unknown) {
    logger.error('[admin/coupons] POST failed', { error });
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return errorResponse('Промокод з таким кодом вже існує', 409);
    }
    return errorResponse('Помилка сервера', 500);
  }
});
