import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

const commentSchema = z.object({
  comment: z.string().max(2000),
});

export const PUT = withRole('admin', 'manager')(
  async (request: NextRequest, { params, user }) => {
    try {
      const { id } = await params!;
      const orderId = Number(id);
      if (isNaN(orderId)) return errorResponse('Невалідний ID', 400);

      const body = await request.json();
      const parsed = commentSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0].message, 422);
      }

      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order) return errorResponse('Замовлення не знайдено', 404);

      const updated = await prisma.order.update({
        where: { id: orderId },
        data: { managerComment: parsed.data.comment },
        select: { id: true, managerComment: true },
      });

      await logAudit({
        userId: user.id,
        actionType: 'data_update',
        entityType: 'order',
        entityId: orderId,
        details: { field: 'managerComment', before: order.managerComment, after: parsed.data.comment },
      });

      return successResponse(updated);
    } catch (err) {
      logger.error('[admin/orders/[id]/comment] PUT failed', { error: err });
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);
