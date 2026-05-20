import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { updateCampaignRule, deleteCampaignRule, CampaignError } from '@/services/campaign';
import { updateCampaignRuleSchema } from '@/validators/campaign';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

export const GET = withRole('admin')(
  async (_request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

      const rule = await prisma.campaignRule.findUnique({
        where: { id: numId },
        include: {
          emailTemplate: { select: { id: true, templateKey: true, subject: true, isActive: true } },
          _count: { select: { logs: true } },
        },
      });

      if (!rule) return errorResponse('Кампанію не знайдено', 404);
      return successResponse(rule);
    } catch (err) {
      logger.error('[admin/campaigns/[id]] GET failed', { error: err });
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);

export const PATCH = withRole('admin')(
  async (request: NextRequest, { params, user }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

      const body = await request.json();
      const parsed = updateCampaignRuleSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
      }

      const rule = await updateCampaignRule(numId, parsed.data);
      await logAudit({
        userId: user.id,
        actionType: 'data_update',
        entityType: 'campaign',
        entityId: numId,
        details: { fields: Object.keys(parsed.data) },
      });
      return successResponse(rule);
    } catch (error) {
      if (error instanceof CampaignError) return errorResponse(error.message, error.statusCode);
      logger.error('[admin/campaigns/[id]] PATCH failed', { error });
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);

export const DELETE = withRole('admin')(
  async (_request: NextRequest, { params, user }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

      await deleteCampaignRule(numId);
      await logAudit({
        userId: user.id,
        actionType: 'data_delete',
        entityType: 'campaign',
        entityId: numId,
      });
      return successResponse({ message: 'Кампанію видалено' });
    } catch (error) {
      if (error instanceof CampaignError) return errorResponse(error.message, error.statusCode);
      logger.error('[admin/campaigns/[id]] DELETE failed', { error });
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);
