import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import {
  PublicationTemplateError,
  deleteTemplate,
  getTemplate,
  updateTemplate,
} from '@/services/publication-template';
import { updateTemplateSchema } from '@/validators/publication-template';

async function readId(ctx: { params?: Promise<Record<string, string>> }): Promise<number | null> {
  const params = (await ctx.params) ?? {};
  const id = Number(params.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export const GET = withRole(
  'admin',
  'manager',
)(async (_request, ctx) => {
  const id = await readId(ctx);
  if (!id) return errorResponse('Невалідний ID', 400);
  try {
    const tpl = await getTemplate(id);
    return successResponse(tpl);
  } catch (err) {
    if (err instanceof PublicationTemplateError) {
      return errorResponse(err.message, err.statusCode);
    }
    logger.error('[admin/publication-templates/[id]] GET failed', { error: err });
    return errorResponse('Помилка завантаження шаблону', 500);
  }
});

export const PUT = withRole(
  'admin',
  'manager',
)(async (request, ctx) => {
  const id = await readId(ctx);
  if (!id) return errorResponse('Невалідний ID', 400);
  try {
    const body = await request.json();
    const parsed = updateTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    // Snapshot before-state so a future "who deactivated this template?"
    // audit question has the answer.
    const before = await getTemplate(id);
    const tpl = await updateTemplate(id, {
      ...parsed.data,
      buttons: parsed.data.buttons ?? undefined,
      channelContents: parsed.data.channelContents ?? undefined,
    });
    await logAudit({
      userId: ctx.user.id,
      actionType: 'data_update',
      entityType: 'publication_template',
      entityId: id,
      details: {
        fields: Object.keys(parsed.data),
        before: { name: before.name, isActive: before.isActive, channels: before.channels },
      },
      ipAddress: getClientIp(request),
    });
    return successResponse(tpl);
  } catch (err) {
    if (err instanceof PublicationTemplateError) {
      return errorResponse(err.message, err.statusCode);
    }
    logger.error('[admin/publication-templates/[id]] PUT failed', { error: err });
    return errorResponse('Помилка оновлення шаблону', 500);
  }
});

export const DELETE = withRole(
  'admin',
  'manager',
)(async (request, ctx) => {
  const id = await readId(ctx);
  if (!id) return errorResponse('Невалідний ID', 400);
  try {
    const before = await getTemplate(id);
    await deleteTemplate(id);
    await logAudit({
      userId: ctx.user.id,
      actionType: 'data_delete',
      entityType: 'publication_template',
      entityId: id,
      details: { name: before.name, channels: before.channels },
      ipAddress: getClientIp(request),
    });
    return successResponse({ deleted: true });
  } catch (err) {
    if (err instanceof PublicationTemplateError) {
      return errorResponse(err.message, err.statusCode);
    }
    logger.error('[admin/publication-templates/[id]] DELETE failed', { error: err });
    return errorResponse('Помилка видалення шаблону', 500);
  }
});
