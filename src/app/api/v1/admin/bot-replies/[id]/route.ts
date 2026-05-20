import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const PUT = withRole('admin', 'manager')(
  async (request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
      const body = await request.json();

      // Whitelist updatable fields to prevent mass-assignment.
      const data: Record<string, unknown> = {};
      if (body.platform !== undefined) data.platform = String(body.platform);
      if (body.triggerType !== undefined) data.triggerType = String(body.triggerType);
      if (body.triggerText !== undefined) data.triggerText = body.triggerText ?? null;
      if (body.responseText !== undefined) data.responseText = String(body.responseText);
      if (body.responseImage !== undefined) data.responseImage = body.responseImage ?? null;
      if (body.buttons !== undefined) data.buttons = body.buttons ?? null;
      if (body.priority !== undefined) data.priority = Number(body.priority) || 0;
      if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

      try {
        const reply = await prisma.botAutoReply.update({ where: { id: numId }, data });
        return successResponse(reply);
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2025') {
          return errorResponse('Авто-відповідь не знайдено', 404);
        }
        throw err;
      }
    } catch (err) {
      logger.error('[admin/bot-replies/[id]] PUT failed', { error: err });
      return errorResponse('Помилка оновлення авто-відповіді', 500);
    }
  }
);

export const DELETE = withRole('admin')(
  async (_request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
      await prisma.botAutoReply.delete({ where: { id: numId } });
      return successResponse({ deleted: true });
    } catch (err) {
      logger.error('[admin/bot-replies/[id]] DELETE failed', { error: err });
      return errorResponse('Помилка видалення авто-відповіді', 500);
    }
  }
);
