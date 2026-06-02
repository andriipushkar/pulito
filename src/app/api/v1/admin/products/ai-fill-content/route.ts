import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { bulkAiFillProductContent } from '@/services/ai-bulk-content';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

// Owner-triggered bulk AI fill of empty product descriptions (post-import).
// Rate-limited (the same expensive-admin bucket as bulk-SEO) because each call
// can run up to 50 AI generations. Returns { filled, remaining } so the UI can
// "click again to process the next batch". FREE until AI keys are set (rules
// fallback), AI-quality after.
export const POST = withRole('admin')(async (request: NextRequest, { user }) => {
  try {
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.adminSeoBulk);
    if (!rl.allowed) {
      return errorResponse(
        `Забагато запитів. Спробуйте через ${Math.ceil(rl.retryAfter / 60)} хв.`,
        429,
      );
    }

    const body = await request.json().catch(() => ({}));
    const limit = Number(body?.limit) > 0 ? Number(body.limit) : 20;

    const result = await bulkAiFillProductContent(limit);

    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'product_content_ai_bulk',
      details: { filled: result.filled, remaining: result.remaining },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    });

    return successResponse(result);
  } catch (err) {
    logger.error('[admin/products/ai-fill-content] failed', { error: err });
    return errorResponse('Помилка автозаповнення контенту', 500);
  }
});
