import { withRole2fa } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

// Mirrors the hash in services/feature-flag.ts. We compute estimated
// enabled-user counts in JS rather than SQL — Postgres doesn't have the same
// >>>0 truncation trick, and keeping the math in one place avoids drift.
function hashUserId(userId: number): number {
  return Math.abs(((userId * 2654435761) >>> 0) % 100);
}

export const GET = withRole2fa('admin')(async () => {
  try {
    const [flags, users] = await Promise.all([
      prisma.featureFlag.findMany({
        select: {
          id: true,
          key: true,
          isEnabled: true,
          rolloutPercent: true,
          targetRoles: true,
          targetUserIds: true,
        },
      }),
      // Active, non-deleted users are the rollout denominator. We pull just
      // id + role so the JS-side loop stays cheap even for ~100k accounts.
      prisma.user.findMany({
        where: { deletedAt: null },
        select: { id: true, role: true },
      }),
    ]);

    const totalUsers = users.length;
    const stats = flags.map((flag) => {
      if (!flag.isEnabled) {
        return {
          id: flag.id,
          key: flag.key,
          enabledUsers: 0,
          totalUsers,
          percent: 0,
        };
      }
      let enabled = 0;
      for (const user of users) {
        if (flag.targetUserIds.includes(user.id)) {
          enabled++;
          continue;
        }
        if (flag.targetRoles.length > 0 && !flag.targetRoles.includes(user.role)) continue;
        if (flag.rolloutPercent < 100 && hashUserId(user.id) >= flag.rolloutPercent) continue;
        enabled++;
      }
      return {
        id: flag.id,
        key: flag.key,
        enabledUsers: enabled,
        totalUsers,
        percent: totalUsers > 0 ? Math.round((enabled / totalUsers) * 1000) / 10 : 0,
      };
    });

    return successResponse({ flags: stats, totalUsers });
  } catch (err) {
    logger.error('[admin/feature-flags/stats] failed', { error: err });
    return errorResponse('Помилка обчислення статистики', 500);
  }
});
