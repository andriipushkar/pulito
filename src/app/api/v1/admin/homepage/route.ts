import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getSeoText, updateSeoText, getHomepageBlocks } from '@/services/homepage';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { sanitizeHtml } from '@/utils/sanitize';
import { logAudit } from '@/services/audit';

const SEO_TEXT_MAX = 50_000;

export const GET = withRole(
  'admin',
  'manager',
)(async () => {
  const [seoText, blocks] = await Promise.all([getSeoText(), getHomepageBlocks()]);

  return successResponse({ seoText, blocks });
});

export const PATCH = withRole('admin')(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();

    if (body.seoText !== undefined) {
      if (typeof body.seoText !== 'string') {
        return errorResponse('seoText повинно бути рядком', 422);
      }
      if (body.seoText.length > SEO_TEXT_MAX) {
        return errorResponse(`seoText занадто довгий (макс ${SEO_TEXT_MAX} символів)`, 422);
      }
      // Sanitize before persistence: the rendered homepage drops this into
      // dangerouslySetInnerHTML, so untrusted markup would be XSS.
      const clean = sanitizeHtml(body.seoText);
      await updateSeoText(clean, user.id);
      await logAudit({
        userId: user.id,
        actionType: 'data_update',
        entityType: 'homepage_seo',
        details: { length: clean.length },
      });
    }

    return successResponse({ success: true });
  } catch (err) {
    logger.error('[admin/homepage] PATCH failed', { error: err });
    return errorResponse('Помилка збереження', 500);
  }
});
