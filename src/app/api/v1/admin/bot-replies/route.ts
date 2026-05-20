import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole('admin', 'manager')(
  async () => {
    try {
      const replies = await prisma.botAutoReply.findMany({
        orderBy: { priority: 'asc' },
      });
      return successResponse(replies);
    } catch (err) {
      logger.error('[admin/bot-replies] GET failed', { error: err });
      return errorResponse('Помилка завантаження авто-відповідей', 500);
    }
  }
);

export const POST = withRole('admin', 'manager')(
  async (request: NextRequest) => {
    try {
      const body = await request.json();
      const reply = await prisma.botAutoReply.create({
        data: {
          triggerText: body.triggerText || null,
          responseText: body.responseText,
          triggerType: body.triggerType || 'partial',
          platform: body.platform || 'all',
          priority: body.priority || 0,
          isActive: body.isActive ?? true,
        },
      });
      return successResponse(reply, 201);
    } catch (err) {
      logger.error('[admin/bot-replies] POST failed', { error: err });
      return errorResponse('Помилка створення авто-відповіді', 500);
    }
  }
);
