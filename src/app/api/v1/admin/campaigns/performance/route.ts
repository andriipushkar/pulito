import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

// Per-rule performance: open rate, click rate, conversion rate. Used by the
// "A/B / Performance" tab on the campaigns page so the admin can compare
// rules side by side without exporting CSVs.
export const GET = withRole('admin', 'manager')(async () => {
  try {
    const rules = await prisma.campaignRule.findMany({
      select: {
        id: true,
        name: true,
        rfmSegment: true,
        frequency: true,
        isActive: true,
        lastRunAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (rules.length === 0) return successResponse([]);

    // One groupBy round-trip instead of N queries.
    const ruleIds = rules.map((r) => r.id);
    const [logsAgg, openedAgg, clickedAgg, convertedAgg] = await Promise.all([
      prisma.campaignLog.groupBy({
        by: ['ruleId'],
        where: { ruleId: { in: ruleIds } },
        _count: { _all: true },
      }),
      prisma.campaignLog.groupBy({
        by: ['ruleId'],
        where: { ruleId: { in: ruleIds }, openedAt: { not: null } },
        _count: { _all: true },
      }),
      prisma.campaignLog.groupBy({
        by: ['ruleId'],
        where: { ruleId: { in: ruleIds }, clickedAt: { not: null } },
        _count: { _all: true },
      }),
      prisma.campaignLog.groupBy({
        by: ['ruleId'],
        where: { ruleId: { in: ruleIds }, conversionOrderId: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const sentMap = new Map(logsAgg.map((g) => [g.ruleId, g._count._all]));
    const openedMap = new Map(openedAgg.map((g) => [g.ruleId, g._count._all]));
    const clickedMap = new Map(clickedAgg.map((g) => [g.ruleId, g._count._all]));
    const convertedMap = new Map(convertedAgg.map((g) => [g.ruleId, g._count._all]));

    const result = rules.map((rule) => {
      const sent = sentMap.get(rule.id) ?? 0;
      const opened = openedMap.get(rule.id) ?? 0;
      const clicked = clickedMap.get(rule.id) ?? 0;
      const converted = convertedMap.get(rule.id) ?? 0;
      const rate = (n: number) => (sent > 0 ? Math.round((n / sent) * 10_000) / 100 : 0);
      return {
        id: rule.id,
        name: rule.name,
        rfmSegment: rule.rfmSegment,
        frequency: rule.frequency,
        isActive: rule.isActive,
        lastRunAt: rule.lastRunAt,
        sent,
        opened,
        clicked,
        converted,
        openRate: rate(opened),
        clickRate: rate(clicked),
        conversionRate: rate(converted),
        // CTR on opens (more honest signal than CTR-on-sent when open rates
        // vary wildly between rules).
        ctrOnOpens: opened > 0 ? Math.round((clicked / opened) * 10_000) / 100 : 0,
      };
    });

    return successResponse(result);
  } catch (err) {
    logger.error('[admin/campaigns/performance] GET failed', { error: err });
    return errorResponse('Помилка обчислення продуктивності кампаній', 500);
  }
});
