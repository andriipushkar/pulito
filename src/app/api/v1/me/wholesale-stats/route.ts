import { withAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { privateResponse, errorResponse } from '@/utils/api-response';

// Compact stats for /account/status — order count, lifetime spend and the
// date the wholesale tier was granted. Aggregates run against the user's own
// rows so RLS isn't required.
export const GET = withAuth(async (_request, { user }) => {
  try {
    const [agg, profile] = await Promise.all([
      prisma.order.aggregate({
        where: { userId: user.id, status: { not: 'cancelled' } },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      prisma.user.findUnique({
        where: { id: user.id },
        select: { wholesaleApprovedDate: true, createdAt: true },
      }),
    ]);

    return privateResponse({
      totalOrders: agg._count._all,
      totalAmount: Number(agg._sum.totalAmount ?? 0),
      memberSince: (
        profile?.wholesaleApprovedDate ??
        profile?.createdAt ??
        new Date()
      ).toISOString(),
    });
  } catch {
    return errorResponse('Не вдалося завантажити статистику', 500);
  }
});
