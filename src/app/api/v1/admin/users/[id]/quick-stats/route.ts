import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withRole2fa(
  'admin',
  'manager',
)(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const userId = Number(id);
    if (isNaN(userId)) return errorResponse('Невалідний ID', 400);

    const [agg, last] = await Promise.all([
      prisma.order.aggregate({
        where: {
          userId,
          status: { notIn: ['cancelled', 'returned'] },
        },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      prisma.order.findFirst({
        where: { userId, status: { notIn: ['cancelled', 'returned'] } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    const lastOrderDays = last
      ? Math.floor((Date.now() - last.createdAt.getTime()) / (24 * 60 * 60 * 1000))
      : null;

    return successResponse({
      totalOrders: agg._count._all,
      totalSpent: Number(agg._sum.totalAmount ?? 0),
      lastOrderDays,
    });
  } catch (error) {
    console.error('[Quick stats user]', error);
    return errorResponse('Помилка', 500);
  }
});
