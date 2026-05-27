import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withRole } from '@/middleware/auth';
import { createProductSchema } from '@/validators/product';
import { createProduct, ProductError } from '@/services/product';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, paginatedResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';

export const GET = withRole(
  'manager',
  'admin',
)(async (request: NextRequest) => {
  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));
    const search = searchParams.get('search')?.trim() || '';
    const skip = (page - 1) * limit;

    const categoryId = searchParams.get('categoryId');
    const brandId = searchParams.get('brandId');
    const isActive = searchParams.get('isActive');
    const stock = searchParams.get('stock');
    const missingBarcode = searchParams.get('missingBarcode');
    const notPublishedOn = searchParams.get('notPublishedOn'); // e.g. "olx"
    const sort = searchParams.get('sort') || 'id_desc';

    // Hide soft-deleted products from the admin list — when a product can't be
    // hard-deleted (FK to order_items) it's left as `deletedAt`-tombstoned for
    // referential integrity, but operators expect it to disappear from the list.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { deletedAt: null };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (categoryId) where.categoryId = Number(categoryId);
    if (brandId === 'null') where.brandId = null;
    else if (brandId) where.brandId = Number(brandId);
    if (isActive === 'true') where.isActive = true;
    else if (isActive === 'false') where.isActive = false;
    if (stock === 'out') where.quantity = 0;
    else if (stock === 'low') where.quantity = { gt: 0, lte: 5 };
    else if (stock === 'in') where.quantity = { gt: 5 };
    if (missingBarcode === '1') where.barcode = null;

    // Server-side exclusion of products already published on a given
    // marketplace channel. Without this, the "Тільки не опубліковані"
    // checkbox in the marketplace ProductsTab filters AFTER pagination —
    // an admin can land on a page showing 0 rows even when later pages
    // still hold unpublished products.
    if (notPublishedOn) {
      where.publications = {
        none: {
          status: 'published',
          channels: { array_contains: [notPublishedOn] },
        },
      };
    }

    const orderByMap: Record<string, object> = {
      id_desc: { id: 'desc' },
      id_asc: { id: 'asc' },
      name_asc: { name: 'asc' },
      name_desc: { name: 'desc' },
      price_asc: { priceRetail: 'asc' },
      price_desc: { priceRetail: 'desc' },
      quantity_asc: { quantity: 'asc' },
      quantity_desc: { quantity: 'desc' },
      sales_desc: { ordersCount: 'desc' },
      sort_order_asc: { sortOrder: 'asc' },
      sort_order_desc: { sortOrder: 'desc' },
      category_asc: { category: { name: 'asc' } },
      category_desc: { category: { name: 'desc' } },
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true,
          code: true,
          name: true,
          slug: true,
          priceRetail: true,
          priceWholesale: true,
          priceWholesale2: true,
          priceWholesale3: true,
          quantity: true,
          isActive: true,
          isPromo: true,
          imagePath: true,
          barcode: true,
          ordersCount: true,
          sortOrder: true,
          // Optimistic-concurrency token so inline-edits in the admin list
          // can pass it back and detect concurrent writes (a second manager
          // editing the same row in another tab).
          version: true,
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
        },
        orderBy: orderByMap[sort] || { id: 'desc' },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return paginatedResponse(products, total, page, limit);
  } catch (err) {
    logger.error('[admin/products] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const POST = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = createProductSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Невалідні дані';
      return errorResponse(firstError, 422);
    }

    const product = await createProduct(parsed.data);

    await logAudit({
      userId: user.id,
      actionType: 'data_create',
      entityType: 'product',
      entityId: product.id,
      details: { code: product.code, name: product.name },
      ipAddress: getClientIp(request),
    });

    // Revalidate catalog pages so new product appears
    try {
      revalidatePath('/catalog');
      revalidatePath('/');
    } catch {
      /* best-effort */
    }

    // Index in Typesense
    import('@/services/typesense').then((ts) => ts.indexProduct(product.id)).catch(() => {});

    return successResponse(product, 201);
  } catch (error) {
    if (error instanceof ProductError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/products] POST failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
