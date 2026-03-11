import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { createProductSchema } from '@/validators/product';
import { createProduct, ProductError } from '@/services/product';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, paginatedResponse } from '@/utils/api-response';

export const GET = withRole('manager', 'admin')(async (request: NextRequest) => {
  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));
    const search = searchParams.get('search')?.trim() || '';
    const skip = (page - 1) * limit;

    const categoryId = searchParams.get('categoryId');
    const isActive = searchParams.get('isActive');
    const stock = searchParams.get('stock');
    const sort = searchParams.get('sort') || 'id_desc';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (categoryId) where.categoryId = Number(categoryId);
    if (isActive === 'true') where.isActive = true;
    else if (isActive === 'false') where.isActive = false;
    if (stock === 'out') where.quantity = 0;
    else if (stock === 'low') where.quantity = { gt: 0, lte: 5 };
    else if (stock === 'in') where.quantity = { gt: 5 };

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
          ordersCount: true,
          category: { select: { id: true, name: true } },
        },
        orderBy: orderByMap[sort] || { id: 'desc' },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return paginatedResponse(products, total, page, limit);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const POST = withRole('manager', 'admin')(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = createProductSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Невалідні дані';
      return errorResponse(firstError, 422);
    }

    const product = await createProduct(parsed.data);
    return successResponse(product, 201);
  } catch (error) {
    if (error instanceof ProductError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
