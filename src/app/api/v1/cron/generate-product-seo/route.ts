import { NextRequest } from 'next/server';
import { bulkGenerateProductSeo, SeoTemplateError } from '@/services/seo-template';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';
import { logger } from '@/lib/logger';

/**
 * Auto-fill SEO meta (seoTitle/seoDescription) for active products that have
 * none, using the admin-defined SEO templates — the SAME engine the manual
 * "bulk generate" button in /admin/seo-templates uses. Template-based, so it
 * costs nothing (no AI/LLM call) and is fully deterministic.
 *
 * Drains in batches (bulkGenerateProductSeo caps at BULK_BATCH_LIMIT per call)
 * up to MAX_BATCHES per run so a large backlog clears over a few runs without
 * one cron tick doing unbounded DB work. Products keep whatever meta an admin
 * later writes by hand — the query only targets rows where seoTitle is still
 * null, so this never overwrites human-edited meta.
 *
 * No-op (and returns 200) when there are no SEO templates configured yet.
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
      const result = await bulkGenerateProductSeo();
      totalUpdated += result.updated;
      remaining = result.remainingWithoutSeo;
      batches++;
      // Stop early once a batch fills nothing (no template match / nothing left).
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
      // Most common: no SEO template configured. Treat as a benign no-op so the
      // cron log isn't noisy red every run before templates exist.
      return successResponse({
        updated: 0,
        batches: 0,
        remainingWithoutSeo: 0,
        skipped: error.message,
      });
    }
    logger.error('[cron/generate-product-seo] failed', { error });
    return errorResponse('Помилка автогенерації SEO', 500);
  }
}
