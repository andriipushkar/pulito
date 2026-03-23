import { NextRequest } from 'next/server';
import { getVolumeDiscountsForProduct } from '@/services/volume-pricing';
import { successResponse, errorResponse } from '@/utils/api-response';

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const productId = params.get('productId');
    if (!productId) {
      return errorResponse('productId обов\'язковий', 400);
    }

    const categoryId = params.get('categoryId');
    const discounts = await getVolumeDiscountsForProduct(
      Number(productId),
      categoryId ? Number(categoryId) : null
    );

    return successResponse(
      discounts.map((d) => ({
        id: d.id,
        minQuantity: d.minQuantity,
        maxQuantity: d.maxQuantity,
        discountPercent: d.discountPercent,
        discountType: d.discountType,
      }))
    );
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
