import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withRole } from '@/middleware/auth';
import { createBrandSchema } from '@/validators/brand';
import { getBrands, createBrand, countBrands, BrandError } from '@/services/brand';
import { successResponse, errorResponse, paginatedResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';

export const GET = withRole(
  'manager',
  'admin',
)(async (request: NextRequest) => {
  try {
    const sp = request.nextUrl.searchParams;
    // Admin sees hidden brands by default; explicit ?includeHidden=false hides them.
    const param = sp.get('includeHidden');
    const includeHidden = param === null ? true : param === 'true';

    // Paginate only when client opts in via ?page/?limit. Legacy UI that
    // fetches the full list keeps getting a flat array — additive change.
    const pageParam = sp.get('page');
    const limitParam = sp.get('limit');
    if (pageParam || limitParam) {
      const page = Math.max(1, Number(pageParam) || 1);
      const limit = Math.min(200, Math.max(1, Number(limitParam) || 50));
      const [brands, total] = await Promise.all([
        getBrands({ includeHidden, includeProductCount: true, page, limit }),
        countBrands({ includeHidden }),
      ]);
      return paginatedResponse(brands, total, page, limit);
    }

    const brands = await getBrands({ includeHidden, includeProductCount: true });
    return successResponse(brands);
  } catch (err) {
    logger.error('[admin/brands] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const POST = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = createBrandSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const brand = await createBrand(parsed.data);
    await logAudit({
      userId: user.id,
      actionType: 'data_create',
      entityType: 'brand',
      entityId: brand.id,
      details: { name: brand.name, slug: brand.slug },
      ipAddress: getClientIp(request),
    });
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
