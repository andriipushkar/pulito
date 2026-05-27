import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import {
  getTopZeroResultSearches,
  getTopAllSearches,
  generateSearchInsights,
} from '@/services/search-intel';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

const schema = z.object({
  provider: z.enum(['claude', 'gemini', 'rules']).optional(),
});

export const GET = withRole(
  'admin',
  'manager',
)(async () => {
  try {
    const [zeroResult, top] = await Promise.all([
      getTopZeroResultSearches(30),
      getTopAllSearches(30),
    ]);
    // Two heavy findMany on every page-load. 60-second private cache keeps
    // the page snappy while admin tweaks filters; data still freshens fast
    // enough to spot new zero-result trends.
    const res = successResponse({ zeroResult, top });
    res.headers.set('Cache-Control', 'private, max-age=60');
    return res;
  } catch {
    return errorResponse('Не вдалося отримати статистику пошуку', 500);
  }
});

// POST returns AI insights based on zero-result queries. Admin-only because
// each call bills Claude/Gemini tokens against the shop's budget — managers
// already see the raw zero-result list from GET.
export const POST = withRole('admin')(async (request: NextRequest, { user }) => {
  try {
    // Rate-limit reuses adminAiGenerate (60/hour). A stuck UI button or a
    // malicious tab loop would otherwise burn through the AI budget while
    // the operator sleeps.
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.adminAiGenerate);
    if (!rl.allowed) {
      return errorResponse(
        `Забагато AI-запитів. Спробуйте через ${Math.ceil(rl.retryAfter / 60)} хв.`,
        429,
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    const provider = parsed.success ? parsed.data.provider : undefined;
    const entries = await getTopZeroResultSearches(30);
    const insights = await generateSearchInsights(entries, { provider });

    await logAudit({
      userId: user.id,
      actionType: 'data_create',
      entityType: 'search_intel_insight',
      details: {
        provider: insights.provider,
        entriesCount: entries.length,
      },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    });

    return successResponse(insights);
  } catch {
    return errorResponse('Не вдалося згенерувати рекомендації', 500);
  }
});
