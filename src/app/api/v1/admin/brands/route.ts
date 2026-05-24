import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withRole } from '@/middleware/auth';
import { createBrandSchema } from '@/validators/brand';
import { getBrands, createBrand, BrandError } from '@/services/brand';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole(
  'manager',
  'admin',
)(async (request: NextRequest) => {
  try {
    // Admin sees hidden brands by default; explicit ?includeHidden=false hides them.
    const param = request.nextUrl.searchParams.get('includeHidden');
    const includeHidden = param === null ? true : param === 'true';
    const brands = await getBrands({
      includeHidden,
      includeProductCount: true,
    });
    return successResponse(brands);
  } catch (err) {
    logger.error('[admin/brands] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const POST = withRole(
  'manager',
  'admin',
)(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = createBrandSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const brand = await createBrand(parsed.data);
    try {
      revalidatePath('/catalog');
      revalidatePath('/sitemap.xml');
    } catch {
      /* best-effort */
    }
    return successResponse(brand, 201);
  } catch (error) {
    if (error instanceof BrandError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/brands] POST failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
