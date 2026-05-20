import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { grantReferralBonus, ReferralError } from '@/services/referral';
import { grantBonusSchema } from '@/validators/referral';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

export const POST = withRole('admin', 'manager')(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const body = await request.json();
    const parsed = grantBonusSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }

    const result = await grantReferralBonus(numId, parsed.data);
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'referral_bonus',
      entityId: numId,
      details: parsed.data,
    });
    return successResponse(result);
  } catch (error) {
    if (error instanceof ReferralError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/referrals/[id]/bonus] POST failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
