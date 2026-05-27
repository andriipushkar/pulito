import { withRole } from '@/middleware/auth';
import { bulkGenerateProductSeo, SeoTemplateError } from '@/services/seo-template';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

export const POST = withRole('admin')(async (request, { user }) => {
  try {
    // Per-admin 5/hour cap — bulk SEO regen is the most expensive admin
    // call (100 upserts + template lookups). A stuck UI button or stolen
    // session can otherwise turn this into a DB-load DoS.
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.adminSeoBulk);
    if (!rl.allowed) {
      return errorResponse(
        `Забагато запитів на генерацію SEO. Спробуйте через ${Math.ceil(rl.retryAfter / 60)} хв.`,
        429,
      );
    }

    const result = await bulkGenerateProductSeo();

    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'product_seo_bulk',
      details: {
        updated: result.updated,
        batchSize: result.total,
        remainingWithoutSeo: result.remainingWithoutSeo,
      },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    });

    return successResponse(result);
  } catch (error) {
    if (error instanceof SeoTemplateError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/seo-templates/generate] POST failed', { error });
    return errorResponse('Помилка генерації SEO', 500);
  }
});
