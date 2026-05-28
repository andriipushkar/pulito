import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    // Clamp limit — without this `?limit=-5` reaches Prisma `take: -5` which
    // reverses the order rather than capping it.
    const raw = Number(request.nextUrl.searchParams.get('limit'));
    const limit = Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), 50) : 6;

    const items = await prisma.orderItem.groupBy({
      by: ['productId', 'productCode', 'productName'],
      where: {
        order: {
          userId: user.id,
          status: { in: ['completed', 'shipped', 'paid', 'processing'] },
        },
      },
      _sum: { quantity: true },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    const productIds = items.map((i) => i.productId).filter(Boolean) as number[];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, imagePath: true },
    });
    const imageMap = new Map(products.map((p) => [p.id, p.imagePath]));

    const result = items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      productCode: item.productCode,
      imagePath: item.productId ? imageMap.get(item.productId) || null : null,
      totalQuantity: item._sum.quantity || 0,
      ordersCount: item._count.id,
    }));

    return successResponse(result);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
