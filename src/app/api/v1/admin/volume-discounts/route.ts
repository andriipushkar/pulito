import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getVolumeDiscounts, createVolumeDiscount, VolumePricingError } from '@/services/volume-pricing';
import { createVolumeDiscountSchema } from '@/validators/volume-discount';
import { successResponse, errorResponse } from '@/utils/api-response';

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
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const POST = withRole('admin')(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = createVolumeDiscountSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }

    const item = await createVolumeDiscount(parsed.data);
    return successResponse(item, 201);
  } catch (error) {
    if (error instanceof VolumePricingError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
