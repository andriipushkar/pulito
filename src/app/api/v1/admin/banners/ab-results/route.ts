import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

// Two-proportion z-test: returns the absolute z-score for the difference
// between two click-through rates. Anything ≥ 1.96 is significant at p<0.05.
// Skips when either variant has zero impressions to avoid div/0.
function twoProportionZ(
  successA: number,
  totalA: number,
  successB: number,
  totalB: number,
): number | null {
  if (totalA <= 0 || totalB <= 0) return null;
  const pA = successA / totalA;
  const pB = successB / totalB;
  const pPool = (successA + successB) / (totalA + totalB);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / totalA + 1 / totalB));
  if (se === 0) return null;
  return Math.abs(pA - pB) / se;
}

export const GET = withRole('admin', 'manager')(async () => {
  try {
    const banners = await prisma.banner.findMany({
      where: { variantGroup: { not: null } },
      select: {
        id: true,
        title: true,
        variantGroup: true,
        variantWeight: true,
        impressions: true,
        clicks: true,
        isActive: true,
      },
      orderBy: [{ variantGroup: 'asc' }, { id: 'asc' }],
    });

    // Group variants by variantGroup so the UI can render head-to-head cards.
    const groups = new Map<
      string,
      Array<{
        id: number;
        title: string | null;
        weight: number;
        impressions: number;
        clicks: number;
        ctr: number;
        isActive: boolean;
      }>
    >();
    for (const b of banners) {
      if (!b.variantGroup) continue;
      const ctr = b.impressions > 0 ? b.clicks / b.impressions : 0;
      const arr = groups.get(b.variantGroup) ?? [];
      arr.push({
        id: b.id,
        title: b.title,
        weight: b.variantWeight,
        impressions: b.impressions,
        clicks: b.clicks,
        ctr: Math.round(ctr * 10_000) / 10_000,
        isActive: b.isActive,
      });
      groups.set(b.variantGroup, arr);
    }

    // For each group of 2+ variants, pick the leader (highest CTR with at
    // least 100 impressions) and compute z-score vs the worst variant so
    // admin can see "leader is statistically ahead" / "still no winner".
    const result = Array.from(groups.entries()).map(([group, variants]) => {
      const eligible = variants.filter((v) => v.impressions >= 100);
      let leader: (typeof variants)[number] | null = null;
      let z: number | null = null;
      if (eligible.length >= 2) {
        const sorted = [...eligible].sort((a, b) => b.ctr - a.ctr);
        leader = sorted[0];
        const worst = sorted[sorted.length - 1];
        if (leader && worst && leader.id !== worst.id) {
          z = twoProportionZ(leader.clicks, leader.impressions, worst.clicks, worst.impressions);
        }
      }
      const totalImpressions = variants.reduce((s, v) => s + v.impressions, 0);
      const totalClicks = variants.reduce((s, v) => s + v.clicks, 0);
      return {
        group,
        variants,
        leaderId: leader?.id ?? null,
        zScore: z != null ? Math.round(z * 100) / 100 : null,
        significant: z != null && z >= 1.96,
        totalImpressions,
        totalClicks,
        overallCtr:
          totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10_000) / 10_000 : 0,
      };
    });

    return successResponse(result);
  } catch (err) {
    logger.error('[admin/banners/ab-results] GET failed', { error: err });
    return errorResponse('Помилка обчислення A/B-результатів', 500);
  }
});
