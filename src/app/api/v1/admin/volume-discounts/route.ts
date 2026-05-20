import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getVolumeDiscounts, createVolumeDiscount, VolumePricingError } from '@/services/volume-pricing';
import { createVolumeDiscountSchema } from '@/validators/volume-discount';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

export const GET = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const params = request.nextUrl.searchParams;
    const filters: { productId?: number; categoryId?: number; isActive?: boolean } = {};

    const productId = params.get('productId');
    if (productId) filters.productId = Number(productId);

    const categoryId = params.get('categoryId');
    if (categoryId) filters.categoryId = Number(categoryId);

    const isActive = params.get('isActive');
    if (isActive !== null) filters.isActive = isActive === 'true';

    const items = await getVolumeDiscounts(filters);
    return successResponse(items);
  } catch (err) {
    logger.error('[admin/volume-discounts] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const POST = withRole('admin')(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = createVolumeDiscountSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }

    const item = await createVolumeDiscount(parsed.data);
    await logAudit({
      userId: user.id,
      actionType: 'data_create',
      entityType: 'volume_discount',
      entityId: item.id,
    });
    return successResponse(item, 201);
  } catch (error) {
    if (error instanceof VolumePricingError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/volume-discounts] POST failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
