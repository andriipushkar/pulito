import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { getLoyaltyLevels, updateLoyaltySettings } from '@/services/loyalty';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

const levelSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1).max(50),
  // Negative `minSpent` would bypass the level-up logic entirely (everyone
  // qualifies for the top tier). Bound multipliers and discount so a typo
  // can't quietly hand out 1000× points or 200% discounts.
  minSpent: z.number().min(0).max(10_000_000),
  pointsMultiplier: z.number().min(0).max(20),
  discountPercent: z.number().min(0).max(100),
  benefits: z.record(z.string(), z.unknown()).nullish(),
  sortOrder: z.number().int().min(0).max(100).default(0),
  pointsExpiryMonths: z.number().int().min(1).max(120).nullish(),
});

const updateSchema = z.object({
  levels: z.array(levelSchema).min(1).max(20),
});

export const GET = withRole('admin')(async () => {
  try {
    const levels = await getLoyaltyLevels();
    return successResponse(levels);
  } catch (err) {
    logger.error('[admin/loyalty/settings] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const PUT = withRole('admin')(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const levels = await updateLoyaltySettings(parsed.data.levels);
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'loyalty_levels',
      details: { count: parsed.data.levels.length },
    });
    return successResponse(levels);
  } catch (err) {
    logger.error('[admin/loyalty/settings] PUT failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
