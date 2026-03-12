import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

const productListSelect = {
  id: true,
  code: true,
  name: true,
  slug: true,
  priceRetail: true,
  priceWholesale: true,
  priceWholesale2: true,
  priceWholesale3: true,
  priceRetailOld: true,
  priceWholesaleOld: true,
  quantity: true,
  isPromo: true,
  isActive: true,
  imagePath: true,
  viewsCount: true,
  ordersCount: true,
  createdAt: true,
  category: {
    select: { id: true, name: true, slug: true },
  },
  badges: {
    select: { id: true, badgeType: true, customText: true, customColor: true, priority: true },
    where: { isActive: true },
    orderBy: { priority: 'desc' as const },
  },
  images: {
    select: {
      id: true,
      pathFull: true,
      pathMedium: true,
      pathThumbnail: true,
      pathBlur: true,
      isMain: true,
    },
    orderBy: [{ isMain: 'desc' as const }, { sortOrder: 'asc' as const }],
  },
  content: {
    select: { shortDescription: true },
  },
};

export async function GET(request: NextRequest) {
  try {
    const idsParam = request.nextUrl.searchParams.get('ids');
    if (!idsParam) {
      return errorResponse('Параметр ids обов\'язковий', 422);
    }

    const ids = idsParam
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0)
      .slice(0, 4);

    if (ids.length === 0) {
      return successResponse([]);
    }

    const products = await prisma.product.findMany({
      where: { id: { in: ids }, isActive: true },
      select: productListSelect,
    });

    // Preserve the order of the requested IDs
    const idOrder = new Map(ids.map((id, i) => [id, i]));
    products.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));

    // Serialize Decimal fields to numbers
    const serialized = products.map((p) => ({
      ...p,
      priceRetail: Number(p.priceRetail),
      priceWholesale: p.priceWholesale ? Number(p.priceWholesale) : null,
      priceWholesale2: p.priceWholesale2 ? Number(p.priceWholesale2) : null,
      priceWholesale3: p.priceWholesale3 ? Number(p.priceWholesale3) : null,
      priceRetailOld: p.priceRetailOld ? Number(p.priceRetailOld) : null,
      priceWholesaleOld: p.priceWholesaleOld ? Number(p.priceWholesaleOld) : null,
    }));

    return successResponse(serialized);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
