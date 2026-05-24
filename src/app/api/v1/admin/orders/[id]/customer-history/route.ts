import { NextRequest } from 'next/server';
import { Prisma } from '@/../generated/prisma';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

/**
 * Returns aggregate stats for this order's customer: how many orders they made,
 * how much they spent, and when they ordered last. Matches by userId when set,
 * otherwise by contactPhone — that's good enough for one-off guest checkouts
 * who reuse a phone number across orders.
 *
 * Excludes the current order from the totals so the owner sees the history
 * BEFORE this order, not "5 orders including this one."
 */
export const GET = withRole(
  'admin',
  'manager',
)(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const orderId = Number(id);
    if (isNaN(orderId)) return errorResponse('Невалідний ID', 400);

    const current = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true, contactPhone: true },
    });
    if (!current) return errorResponse('Замовлення не знайдено', 404);

    // Exclude cancelled / returned orders from the lifetime aggregate — they
    // represent value the customer DIDN'T capture, so counting them inflates
    // "5 orders / 12000₴" and misleads the manager (e.g. into giving a loyalty
    // upsell they haven't earned).
    const baseWhere: Prisma.OrderWhereInput = {
      NOT: { id: orderId },
      status: { notIn: ['cancelled', 'returned'] },
    };
    const where: Prisma.OrderWhereInput | null = current.userId
      ? { ...baseWhere, userId: current.userId }
      : current.contactPhone
        ? { ...baseWhere, contactPhone: current.contactPhone }
        : null;

    if (!where) {
      return successResponse({ totalOrders: 0, totalSpent: 0, lastOrderDate: null });
    }

    const [aggregate, last] = await Promise.all([
      prisma.order.aggregate({
        where,
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      prisma.order.findFirst({
        where,
        select: { createdAt: true, orderNumber: true, id: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return successResponse({
      totalOrders: aggregate._count._all,
      totalSpent: Number(aggregate._sum.totalAmount ?? 0),
      lastOrderDate: last?.createdAt ?? null,
      lastOrderNumber: last?.orderNumber ?? null,
      lastOrderId: last?.id ?? null,
    });
  } catch (error) {
    logger.error('[Admin Order Customer History]', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
