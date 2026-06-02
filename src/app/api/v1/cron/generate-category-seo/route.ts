import { NextRequest } from 'next/server';
import { bulkGenerateCategorySeo, SeoTemplateError } from '@/services/seo-template';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';
import { logger } from '@/lib/logger';

/**
 * Auto-fill SEO meta (seoTitle/seoDescription) for categories that have none,
 * using the admin-defined `category` SEO template. Counterpart to
 * generate-product-seo. Template-based → costs nothing (no AI/LLM call) and
 * never overwrites human-edited meta (only targets rows where seoTitle is
 * still null/empty). No-op (200) until a `category` template exists.
 */
const MAX_BATCHES = 5;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${env.APP_SECRET}`;
    if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
      return errorResponse('Unauthorized', 401);
    }

    let totalUpdated = 0;
    let remaining = 0;
    let batches = 0;

    for (let i = 0; i < MAX_BATCHES; i++) {
      const result = await bulkGenerateCategorySeo();
      totalUpdated += result.updated;
      remaining = result.remainingWithoutSeo;
      batches++;
      if (result.updated === 0) break;
      if (remaining === 0) break;
    }

    return successResponse({
      updated: totalUpdated,
      batches,
      remainingWithoutSeo: remaining,
    });
  } catch (error) {
    if (error instanceof SeoTemplateError) {
      return successResponse({
        updated: 0,
        batches: 0,
        remainingWithoutSeo: 0,
        skipped: error.message,
      });
    }
    logger.error('[cron/generate-category-seo] failed', { error });
    return errorResponse('Помилка автогенерації SEO категорій', 500);
  }
}
