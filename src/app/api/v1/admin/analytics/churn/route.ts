import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(365, Math.max(7, Number(searchParams.get('days')) || 90));
    const since = new Date();
    since.setDate(since.getDate() - days);

    const now = new Date();

    // Get all customers who had orders before the analysis period
    const allCustomers = await prisma.order.groupBy({
      by: ['userId'],
      where: {
        userId: { not: null },
        NOT: [{ status: 'cancelled' }, { status: 'returned' }],
      },
      _count: { id: true },
      _sum: { totalAmount: true },
      _max: { createdAt: true },
      _min: { createdAt: true },
    });

    // Calculate average days between orders
    const intervals: number[] = [];
    for (const c of allCustomers) {
      const count = c._count?.id ?? 0;
      if (count > 1 && c._min?.createdAt && c._max?.createdAt) {
        const span = (new Date(c._max.createdAt).getTime() - new Date(c._min.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        intervals.push(span / (count - 1));
      }
    }
    const avgDaysBetweenOrders = intervals.length > 0
      ? intervals.reduce((a, b) => a + b, 0) / intervals.length
      : 30;

    // Churn threshold: 2x average interval or minimum 60 days
    const churnThresholdDays = Math.max(avgDaysBetweenOrders * 2, 60);

    // Identify at-risk customers
    const atRiskCustomers: {
      id: number;
      email: string;
      fullName: string | null;
      lastOrderDate: string;
      daysSinceLastOrder: number;
      totalOrders: number;
      totalSpent: number;
      churnProbability: number;
    }[] = [];

    let churnedCount = 0;
    let activeCount = 0;

    for (const c of allCustomers) {
      if (!c.userId || !c._max?.createdAt) continue;
      const daysSince = Math.floor((now.getTime() - new Date(c._max.createdAt).getTime()) / (1000 * 60 * 60 * 24));

      if (daysSince > churnThresholdDays) {
        churnedCount++;
      } else {
        activeCount++;
      }

      // At-risk: between 50% and 100% of churn threshold
      if (daysSince > churnThresholdDays * 0.5 && daysSince <= churnThresholdDays * 1.5) {
        const probability = Math.min(95, Math.round((daysSince / churnThresholdDays) * 80));
        atRiskCustomers.push({
          id: c.userId,
          email: '',
          fullName: null,
          lastOrderDate: c._max.createdAt.toISOString(),
          daysSinceLastOrder: daysSince,
          totalOrders: c._count?.id ?? 0,
          totalSpent: Number(c._sum.totalAmount) || 0,
          churnProbability: probability,
        });
      }
    }

    // Enrich at-risk customers with user info
    if (atRiskCustomers.length > 0) {
      const userIds = atRiskCustomers.map((c) => c.id);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, fullName: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u]));
      for (const c of atRiskCustomers) {
        const user = userMap.get(c.id);
        if (user) {
          c.email = user.email;
          c.fullName = user.fullName;
        }
      }
    }

    atRiskCustomers.sort((a, b) => b.churnProbability - a.churnProbability);

    // Monthly churn data
    const churnByMonth: { month: string; churned: number; retained: number; rate: number }[] = [];
    const monthsToShow = Math.min(Math.floor(days / 30), 12);

    for (let i = 0; i < monthsToShow; i++) {
      const monthEnd = new Date(now);
      monthEnd.setMonth(monthEnd.getMonth() - i);
      monthEnd.setDate(0); // Last day of previous month
      const monthStart = new Date(monthEnd);
      monthStart.setDate(1);

      let monthChurned = 0;
      let monthRetained = 0;

      for (const c of allCustomers) {
        if (!c._max?.createdAt) continue;
        const lastOrder = new Date(c._max.createdAt);
        if (lastOrder < monthStart) {
          const daysSinceMonth = Math.floor((monthEnd.getTime() - lastOrder.getTime()) / (1000 * 60 * 60 * 24));
          if (daysSinceMonth > churnThresholdDays) monthChurned++;
        } else if (lastOrder <= monthEnd) {
          monthRetained++;
        }
      }

      const total = monthChurned + monthRetained;
      churnByMonth.unshift({
        month: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
        churned: monthChurned,
        retained: monthRetained,
        rate: total > 0 ? Math.round((monthChurned / total) * 100) : 0,
      });
    }

    const totalTracked = churnedCount + activeCount;
    const churnRate = totalTracked > 0 ? (churnedCount / totalTracked) * 100 : 0;
    const retentionRate = 100 - churnRate;

    return successResponse({
      atRiskCustomers: atRiskCustomers.slice(0, 50),
      churnRate,
      avgDaysBetweenOrders,
      retentionRate,
      churnByMonth,
    });
  } catch (error) {
    console.error('[Churn Prediction]', error);
    return errorResponse('Помилка прогнозу відтоку', 500);
  }
});
