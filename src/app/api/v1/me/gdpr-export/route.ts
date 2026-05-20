import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { exportUserData } from '@/services/user';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { errorResponse } from '@/utils/api-response';
import { createApiHandler } from '@/lib/api-handler';
import { RATE_LIMITS } from '@/services/rate-limit';

/**
 * GDPR Art.20 personal data export. Returns a JSON blob with everything the
 * user is entitled to receive: profile, orders, addresses, wishlists. Heavily
 * rate-limited (sensitive RL bucket) — this is not a hot path and abuse would
 * be a privacy exfil vector.
 */
export const GET = createApiHandler(
  RATE_LIMITS.sensitive,
  withAuth(async (request: NextRequest, { user }) => {
    try {
      const data = await exportUserData(user.id);
      await logAudit({
        userId: user.id,
        actionType: 'gdpr_export',
        entityType: 'user',
        entityId: user.id,
        ipAddress: getClientIp(request),
      });

      const blob = JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          gdprArticle: 'Article 20 — Right to data portability',
          data,
        },
        null,
        2,
      );

      return new NextResponse(blob, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="pulito-data-export-${user.id}-${Date.now()}.json"`,
          'Cache-Control': 'no-store',
        },
      });
    } catch {
      return errorResponse('Не вдалося сформувати експорт', 500);
    }
  }),
);
