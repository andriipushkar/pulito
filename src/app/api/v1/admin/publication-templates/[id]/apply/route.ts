import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { PublicationTemplateError, applyTemplate } from '@/services/publication-template';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { applyTemplateSchema } from '@/validators/publication-template';

export const POST = withRole(
  'admin',
  'manager',
)(async (request, ctx) => {
  const params = (await ctx.params) ?? {};
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) return errorResponse('Невалідний ID', 400);

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = applyTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const productId = parsed.data.productId ?? null;
    const result = await applyTemplate(id, productId);

    // Apply hydrates a publication form from a template — tracking who
    // pulled the trigger helps trace duplicate-post incidents.
    await logAudit({
      userId: ctx.user.id,
      actionType: 'data_update',
      entityType: 'publication_template_apply',
      entityId: id,
      details: { action: 'apply', productId },
      ipAddress: getClientIp(request),
    });

    return successResponse(result);
  } catch (err) {
    if (err instanceof PublicationTemplateError) {
      return errorResponse(err.message, err.statusCode);
    }
    logger.error('[admin/publication-templates/[id]/apply] POST failed', { error: err });
    return errorResponse('Помилка застосування шаблону', 500);
  }
});
