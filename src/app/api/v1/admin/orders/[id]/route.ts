import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getOrderById } from '@/services/order';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

export const GET = withRole('admin', 'manager')(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const order = await getOrderById(numId);
    if (!order) {
      return errorResponse('Замовлення не знайдено', 404);
    }
    return successResponse(order);
  } catch (error) {
    logger.error('[admin/orders/[id]] GET failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const PUT = withRole('admin', 'manager')(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const body = await request.json();

    const data: { assignedManagerId?: number | null } = {};
    if ('assignedManagerId' in body) {
      const raw = body.assignedManagerId;
      if (raw === null || raw === undefined || raw === '') {
        data.assignedManagerId = null;
      } else {
        const mgr = Number(raw);
        if (!Number.isInteger(mgr) || mgr <= 0) {
          return errorResponse('Невалідний assignedManagerId', 400);
        }
        // Validate the user exists and is a manager/admin — otherwise we'd
        // dangle a foreign-key-style pointer to a deleted or wrong-role user.
        const mgrUser = await prisma.user.findUnique({
          where: { id: mgr },
          select: { id: true, role: true, deletedAt: true },
        });
        if (!mgrUser || mgrUser.deletedAt || !['admin', 'manager'].includes(mgrUser.role)) {
          return errorResponse('Користувача не знайдено або він не є менеджером', 400);
        }
        data.assignedManagerId = mgr;
      }
    }

    if (Object.keys(data).length === 0) return errorResponse('Немає даних для оновлення', 400);

    // Capture the previous assignedManagerId so we can audit the change.
    const prev = await prisma.order.findUnique({
      where: { id: numId },
      select: { assignedManagerId: true },
    });

    try {
      await prisma.order.update({ where: { id: numId }, data });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2025') {
        return errorResponse('Замовлення не знайдено', 404);
      }
      throw err;
    }

    if ('assignedManagerId' in data && prev) {
      await logAudit({
        userId: user.id,
        actionType: 'data_update',
        entityType: 'order',
        entityId: numId,
        details: {
          field: 'assignedManagerId',
          before: prev.assignedManagerId,
          after: data.assignedManagerId,
        },
      });
    }

    const order = await getOrderById(numId);
    return successResponse(order);
  } catch (error) {
    logger.error('[admin/orders/[id]] PUT failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
