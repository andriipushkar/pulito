import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { runCampaignNow, CampaignError } from '@/services/campaign';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

export const POST = withRole('admin')(async (_request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const ruleId = Number(id);
    if (!ruleId) return errorResponse('Невалідний ID', 400);

    const result = await runCampaignNow(ruleId);
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'campaign_run',
      entityId: ruleId,
      details: { sent: result.sent, skipped: result.skipped, trigger: 'manual' },
    });
    return successResponse(result);
  } catch (err) {
    if (err instanceof CampaignError) {
      return errorResponse(err.message, err.statusCode);
    }
    logger.error('[admin/campaigns/send-now] failed', { error: err });
    return errorResponse('Внутрішня помилка', 500);
  }
});
