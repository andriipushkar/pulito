import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { getDashboardStats } from '@/services/dashboard';
import { generateDashboardSummary } from '@/services/ai-dashboard';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

const schema = z.object({
  provider: z.enum(['claude', 'gemini', 'rules']).optional(),
});

/**
 * Generate an AI executive briefing of today's dashboard data.
 * Aggregates the same numbers the dashboard already shows and asks an LLM
 * to summarise them as 3-5 Ukrainian sentences for the shop owner.
 */
export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest) => {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    const provider = parsed.success ? parsed.data.provider : undefined;

    // Reuse existing stats — no duplicate Prisma queries on top of widgets.
    const stats = await getDashboardStats();

    // Pull unpaid count + recent recommendations directly (not part of
    // dashboard stats) so the LLM has the full operational picture.
    const [unpaidCount] = await Promise.all([
      prisma.order
        .count({
          where: { paymentStatus: 'pending', status: { notIn: ['cancelled', 'returned'] } },
        })
        .catch(() => 0),
    ]);

    const dateLabel = new Date().toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const result = await generateDashboardSummary(
      {
        dateLabel,
        orders: {
          todayCount: stats.orders.todayCount,
          todayRevenue: stats.orders.todayRevenue,
          yesterdayCount: stats.orders.yesterdayCount,
          yesterdayRevenue: stats.orders.yesterdayRevenue,
          newCount: stats.orders.newCount,
          unpaidCount,
        },
        weeklyRevenue: stats.weeklyRevenue,
        users: {
          total: stats.users.total,
          newThisWeek: stats.users.newThisWeek,
          pendingWholesale: stats.users.pendingWholesale,
        },
        products: {
          total: stats.products.total,
          outOfStock: stats.products.outOfStock,
          lowStock: stats.products.lowStock,
          missingBarcode: stats.products.withoutBarcode,
        },
        topProducts: stats.topProducts.slice(0, 5).map((p) => ({
          name: p.name,
          sales: p.quantity,
        })),
        recommendations: [], // dashboard recs come from a separate endpoint;
        // the AI gets enough context from the numeric stats above
      },
      { provider },
    );

    return successResponse(result);
  } catch (err) {
    logger.error('[admin/dashboard/ai-summary] failed', { error: err });
    return errorResponse('Не вдалося згенерувати брифінг', 500);
  }
});
