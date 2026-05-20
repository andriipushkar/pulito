import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getCampaignRules, createCampaignRule, CampaignError } from '@/services/campaign';
import { createCampaignRuleSchema } from '@/validators/campaign';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

export const GET = withRole('admin')(
  async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const isActive = searchParams.get('isActive');
      const rfmSegment = searchParams.get('rfmSegment') || undefined;

      const rules = await getCampaignRules({
        isActive: isActive !== null ? isActive === 'true' : undefined,
        rfmSegment,
      });

      return successResponse(rules);
    } catch (err) {
      logger.error('[admin/campaigns] GET failed', { error: err });
      return errorResponse('Помилка завантаження кампаній', 500);
    }
  }
);

export const POST = withRole('admin')(
  async (request: NextRequest, { user }) => {
    try {
      const body = await request.json();
      const parsed = createCampaignRuleSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
      }

      const rule = await createCampaignRule(parsed.data);
      await logAudit({
        userId: user.id,
        actionType: 'data_create',
        entityType: 'campaign',
        entityId: rule.id,
        details: { name: rule.name, rfmSegment: rule.rfmSegment, frequency: rule.frequency },
      });
      return successResponse(rule, 201);
    } catch (error) {
      if (error instanceof CampaignError) return errorResponse(error.message, error.statusCode);
      logger.error('[admin/campaigns] POST failed', { error });
      return errorResponse('Помилка створення кампанії', 500);
    }
  }
);
