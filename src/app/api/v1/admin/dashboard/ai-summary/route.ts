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
  force: z.boolean().optional(),
});

// Every dashboard visit auto-generates a briefing; without a cache that's one
// LLM call per page view and the Gemini free tier (~20 req/day) is exhausted
// by morning. 30 min is fresh enough for "today's numbers" prose.
const CACHE_KEY = 'ai_dashboard_summary_cache';
const CACHE_TTL_MS = 30 * 60 * 1000;

interface CachedSummary {
  text: string;
  provider: 'claude' | 'gemini' | 'rules';
  generatedAt: string;
}

async function readCache(): Promise<CachedSummary | null> {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: CACHE_KEY } });
    if (!row?.value) return null;
    const parsed = JSON.parse(row.value) as CachedSummary;
    if (Date.now() - new Date(parsed.generatedAt).getTime() > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

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
    const force = parsed.success ? (parsed.data.force ?? false) : false;

    if (!force) {
      const cached = await readCache();
      if (cached) {
        return successResponse({ text: cached.text, provider: cached.provider });
      }
    }

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

    // Rules output is free to recompute and would otherwise mask an LLM
    // provider recovering from a transient 429 — only cache real LLM results.
    if (result.provider !== 'rules') {
      const payload: CachedSummary = {
        text: result.text,
        provider: result.provider,
        generatedAt: new Date().toISOString(),
      };
      await prisma.siteSetting
        .upsert({
          where: { key: CACHE_KEY },
          update: { value: JSON.stringify(payload) },
          create: { key: CACHE_KEY, value: JSON.stringify(payload) },
        })
        .catch(() => undefined);
    }

    return successResponse(result);
  } catch (err) {
    logger.error('[admin/dashboard/ai-summary] failed', { error: err });
    return errorResponse('Не вдалося згенерувати брифінг', 500);
  }
});
