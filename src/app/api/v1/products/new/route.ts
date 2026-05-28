import { NextRequest } from 'next/server';
import { getNewProducts } from '@/services/product';
import { successResponse, errorResponse } from '@/utils/api-response';

export async function GET(request: NextRequest) {
  try {
    // `Number('-50') || 10` returns -50; without positive guard Prisma sees
    // `take: -50` which reverses the query rather than capping it.
    const raw = Number(request.nextUrl.searchParams.get('limit'));
    const limit = Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), 50) : 10;
    const products = await getNewProducts(limit);
    return successResponse(products);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
