import { NextRequest } from 'next/server';
import { getVolumeDiscountsForProduct } from '@/services/volume-pricing';
import { successResponse, errorResponse } from '@/utils/api-response';

function toPositiveInt(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && Number.isInteger(n) ? n : null;
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const productId = toPositiveInt(params.get('productId'));
    if (productId === null) {
      return errorResponse('Невалідний productId', 400);
    }
    // categoryId is optional — reject only invalid non-empty values, treat
    // missing/empty as null (no category filter).
    const categoryRaw = params.get('categoryId');
    const categoryId = categoryRaw ? toPositiveInt(categoryRaw) : null;
    if (categoryRaw && categoryId === null) {
      return errorResponse('Невалідний categoryId', 400);
    }

    const discounts = await getVolumeDiscountsForProduct(productId, categoryId);

    return successResponse(
      discounts.map((d) => ({
        id: d.id,
        minQuantity: d.minQuantity,
        maxQuantity: d.maxQuantity,
        discountPercent: d.discountPercent,
        discountType: d.discountType,
      })),
    );
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
