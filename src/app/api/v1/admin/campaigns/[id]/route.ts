import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { updateCampaignRule, deleteCampaignRule, CampaignError } from '@/services/campaign';
import { updateCampaignRuleSchema } from '@/validators/campaign';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

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
    } catch {
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);

export const PATCH = withRole('admin')(
  async (request: NextRequest, { params }) => {
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
      return successResponse(rule);
    } catch (error) {
      if (error instanceof CampaignError) return errorResponse(error.message, error.statusCode);
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);

export const DELETE = withRole('admin')(
  async (_request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

      await deleteCampaignRule(numId);
      return successResponse({ message: 'Кампанію видалено' });
    } catch (error) {
      if (error instanceof CampaignError) return errorResponse(error.message, error.statusCode);
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);
