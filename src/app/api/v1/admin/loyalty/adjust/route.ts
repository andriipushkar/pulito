import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { adjustPoints, LoyaltyError } from '@/services/loyalty';
import { adjustPointsSchema } from '@/validators/loyalty';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { redis } from '@/lib/redis';

export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = adjustPointsSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }

    // Idempotency: fingerprint (admin, target, type, amount, description)
    // and reject duplicates within 30s. Catches fast double-clicks AND
    // network-retry double-submits. If admin really wants two identical
    // adjustments — change description or wait 30s.
    const fingerprint = crypto
      .createHash('sha256')
      .update(
        [
          user.id,
          parsed.data.userId,
          parsed.data.type,
          parsed.data.points,
          parsed.data.description,
        ].join(':'),
      )
      .digest('hex')
      .slice(0, 32);
    const wasSet = await redis.set(`loyalty:adjust:${fingerprint}`, '1', 'EX', 30, 'NX');
    if (!wasSet) {
      return errorResponse(
        'Однакове коригування вже виконано щойно. Якщо це навмисно — змініть опис або зачекайте 30 с.',
        409,
      );
    }

    await adjustPoints(parsed.data);

    // Audit-log every manual adjust — required for fraud investigations
    // ("who gave 5000 points to user X?") and compliance.
    await logAudit({
      userId: user.id,
      actionType: 'rule_change',
      entityType: 'loyalty_adjust',
      entityId: parsed.data.userId,
      details: {
        targetUserId: parsed.data.userId,
        type: parsed.data.type,
        points: parsed.data.points,
        description: parsed.data.description,
      },
      ipAddress: getClientIp(request),
    });

    return successResponse({ success: true });
  } catch (error) {
    if (error instanceof LoyaltyError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/loyalty/adjust] POST failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
