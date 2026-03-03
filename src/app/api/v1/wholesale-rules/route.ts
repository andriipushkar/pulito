import { withAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withAuth(async (_request, { user }) => {
  try {
    if (user.role !== 'wholesaler' && user.role !== 'admin' && user.role !== 'manager') {
      return errorResponse('Доступ заборонено', 403);
    }

    const rules = await prisma.wholesaleRule.findMany({
      where: { isActive: true },
      include: {
        product: { select: { id: true, name: true } },
      },
      orderBy: { ruleType: 'asc' },
    });

    const result = rules.map((r) => ({
      id: r.id,
      ruleType: r.ruleType,
      productId: r.productId,
      productName: r.product?.name || null,
      value: Number(r.value),
      isActive: r.isActive,
    }));

    return successResponse(result);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
