import { NextRequest } from 'next/server';
import { getActiveBundles, calculateBundlePrice } from '@/services/bundle';
import { paginatedResponse, errorResponse, parseSearchParams } from '@/utils/api-response';

export async function GET(request: NextRequest) {
  try {
    const { page, limit } = parseSearchParams(request.nextUrl.searchParams);
    const { bundles, total } = await getActiveBundles(page, limit);

    const bundlesWithPrices = await Promise.all(
      bundles.map(async (bundle) => {
        const pricing = await calculateBundlePrice(bundle.id);
        return { ...bundle, pricing };
      })
    );

    return paginatedResponse(bundlesWithPrices, total, page, limit);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
