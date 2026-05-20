import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import {
  getRepricingRules,
  saveRepricingRules,
  type RepricingRule,
} from '@/services/marketplace-repricing';
import { isMarketplacePlatform } from '@/services/marketplace-health';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole('admin', 'manager')(
  async (_req: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      if (!isMarketplacePlatform(id)) return errorResponse('Невідома платформа', 400);
      const rules = await getRepricingRules(id);
      return successResponse(rules);
    } catch (err) {
      logger.error('[admin/marketplaces/[id]/repricing] GET failed', { error: err });
      return errorResponse('Помилка завантаження правил', 500);
    }
  },
);

export const PUT = withRole('admin')(async (req: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    if (!isMarketplacePlatform(id)) return errorResponse('Невідома платформа', 400);

    const body = (await req.json()) as { rules?: unknown };
    if (!Array.isArray(body.rules)) {
      return errorResponse('rules має бути масивом', 400);
    }

    // Server-side normalisation: drop entries without required keys, clamp markup.
    const normalized: RepricingRule[] = [];
    for (const raw of body.rules as Record<string, unknown>[]) {
      if (!raw || typeof raw !== 'object') continue;
      const ruleId = typeof raw.id === 'string' ? raw.id : '';
      const name = typeof raw.name === 'string' ? raw.name.trim() : '';
      const markupPercent = Number(raw.markupPercent);
      const enabled = raw.enabled !== false;
      const condition = raw.condition as RepricingRule['condition'] | undefined;
      if (!ruleId || !name || !Number.isFinite(markupPercent) || !condition) continue;
      normalized.push({ id: ruleId, name, enabled, condition, markupPercent });
    }

    await saveRepricingRules(id, normalized);
    return successResponse({ saved: normalized.length });
  } catch (err) {
    logger.error('[admin/marketplaces/[id]/repricing] PUT failed', { error: err });
    return errorResponse('Помилка збереження правил', 500);
  }
});
