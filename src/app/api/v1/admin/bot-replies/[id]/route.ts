import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { updateBotReplySchema } from '@/validators/bot';

export const PUT = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const body = await request.json();
    const parsed = updateBotReplySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const d = parsed.data;

    const data: Record<string, unknown> = {};
    if (d.platform !== undefined) data.platform = d.platform;
    if (d.triggerType !== undefined) data.triggerType = d.triggerType;
    if (d.triggerText !== undefined) data.triggerText = d.triggerText;
    if (d.responseText !== undefined) data.responseText = d.responseText;
    if (d.responseImage !== undefined) data.responseImage = d.responseImage;
    if (d.buttons !== undefined) data.buttons = d.buttons ?? undefined;
    if (d.priority !== undefined) data.priority = d.priority;
    if (d.isActive !== undefined) data.isActive = d.isActive;

    try {
      const reply = await prisma.botAutoReply.update({ where: { id: numId }, data });
      await logAudit({
        userId: user.id,
        actionType: 'data_update',
        entityType: 'bot_auto_reply',
        entityId: numId,
        details: { fields: Object.keys(d) },
        ipAddress: getClientIp(request),
      });
      return successResponse(reply);
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2025'
      ) {
        return errorResponse('Авто-відповідь не знайдено', 404);
      }
      throw err;
    }
  } catch (err) {
    logger.error('[admin/bot-replies/[id]] PUT failed', { error: err });
    return errorResponse('Помилка оновлення авто-відповіді', 500);
  }
});

export const DELETE = withRole('admin')(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const before = await prisma.botAutoReply.findUnique({
      where: { id: numId },
      select: { platform: true, triggerType: true, triggerText: true },
    });
    if (!before) return errorResponse('Авто-відповідь не знайдено', 404);

    await prisma.botAutoReply.delete({ where: { id: numId } });
    await logAudit({
      userId: user.id,
      actionType: 'data_delete',
      entityType: 'bot_auto_reply',
      entityId: numId,
      details: before,
      ipAddress: getClientIp(request),
    });
    return successResponse({ deleted: true });
  } catch (err) {
    logger.error('[admin/bot-replies/[id]] DELETE failed', { error: err });
    return errorResponse('Помилка видалення авто-відповіді', 500);
  }
});
