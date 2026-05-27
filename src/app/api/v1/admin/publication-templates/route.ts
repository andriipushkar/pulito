import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import {
  PublicationTemplateError,
  createTemplate,
  listTemplates,
} from '@/services/publication-template';
import { createTemplateSchema } from '@/validators/publication-template';

export const GET = withRole(
  'admin',
  'manager',
)(async (request: NextRequest) => {
  try {
    const url = new URL(request.url);
    const activeOnly = url.searchParams.get('active') === '1';
    const templates = await listTemplates(activeOnly);
    return successResponse(templates);
  } catch (err) {
    logger.error('[admin/publication-templates] GET failed', { error: err });
    return errorResponse('Помилка завантаження шаблонів', 500);
  }
});

export const POST = withRole(
  'admin',
  'manager',
)(async (request, ctx) => {
  try {
    const body = await request.json();
    const parsed = createTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const tpl = await createTemplate(
      {
        ...parsed.data,
        // null → undefined to match service signature on optional fields.
        buttons: parsed.data.buttons ?? undefined,
        channelContents: parsed.data.channelContents ?? undefined,
      },
      ctx.user.id,
    );
    await logAudit({
      userId: ctx.user.id,
      actionType: 'data_create',
      entityType: 'publication_template',
      entityId: tpl.id,
      details: { name: tpl.name, channels: parsed.data.channels },
      ipAddress: getClientIp(request),
    });
    return successResponse(tpl, 201);
  } catch (err) {
    if (err instanceof PublicationTemplateError) {
      return errorResponse(err.message, err.statusCode);
    }
    logger.error('[admin/publication-templates] POST failed', { error: err });
    return errorResponse('Помилка створення шаблону', 500);
  }
});
