import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { editOrderItems, OrderError } from '@/services/order';
import { successResponse, errorResponse } from '@/utils/api-response';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

const editItemsSchema = z.object({
  items: z
    .array(
      z
        .object({
          itemId: z.number().int().positive().optional(),
          productId: z.number().int().positive().optional(),
          // qty must be ≥ 1 for an active line. Use `remove: true` to drop a line.
          quantity: z.number().int().min(1).default(1),
          remove: z.boolean().optional(),
        })
        .refine((line) => line.remove || line.quantity >= 1, {
          message: 'Кількість повинна бути ≥ 1, або вкажіть remove: true',
        }),
    )
    .min(1, 'Потрібно вказати хоча б одну позицію'),
});

export const PUT = withRole('admin', 'manager')(async (request: NextRequest, { user, params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const body = await request.json();
    const parsed = editItemsSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }

    const order = await editOrderItems(numId, parsed.data.items, user.id);
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'order',
      entityId: numId,
      details: { field: 'items', changes: parsed.data.items },
    });
    return successResponse(order);
  } catch (error) {
    if (error instanceof OrderError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/orders/[id]/items] PUT failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
