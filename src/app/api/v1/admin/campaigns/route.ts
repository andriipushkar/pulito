import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getCampaignRules, createCampaignRule, CampaignError } from '@/services/campaign';
import { createCampaignRuleSchema } from '@/validators/campaign';
import { successResponse, errorResponse } from '@/utils/api-response';

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
    } catch {
      return errorResponse('Помилка завантаження кампаній', 500);
    }
  }
);

export const POST = withRole('admin')(
  async (request: NextRequest) => {
    try {
      const body = await request.json();
      const parsed = createCampaignRuleSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
      }

      const rule = await createCampaignRule(parsed.data);
      return successResponse(rule, 201);
    } catch (error) {
      if (error instanceof CampaignError) return errorResponse(error.message, error.statusCode);
      return errorResponse('Помилка створення кампанії', 500);
    }
  }
);
