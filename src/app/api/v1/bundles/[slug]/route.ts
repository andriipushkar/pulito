import { NextRequest } from 'next/server';
import { getBundleBySlug, calculateBundlePrice } from '@/services/bundle';
import { successResponse, errorResponse } from '@/utils/api-response';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const bundle = await getBundleBySlug(slug);

    if (!bundle) {
      return errorResponse('Комплект не знайдено', 404);
    }

    const pricing = await calculateBundlePrice(bundle.id);

    return successResponse({ ...bundle, pricing });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
