import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import {
  getWarehouseById,
  updateWarehouse,
  deleteWarehouse,
  WarehouseError,
} from '@/services/warehouse';
import { updateWarehouseSchema } from '@/validators/warehouse';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';

export const GET = withRole(
  'admin',
  'manager',
)(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const warehouse = await getWarehouseById(numId);
    return successResponse(warehouse);
  } catch (error) {
    if (error instanceof WarehouseError) return errorResponse(error.message, error.statusCode);
    logger.error('[admin/warehouses/[id]] GET failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const PATCH = withRole('admin')(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const body = await request.json();
    const parsed = updateWarehouseSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const warehouse = await updateWarehouse(numId, parsed.data);
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'warehouse',
      entityId: numId,
      details: { fields: Object.keys(parsed.data) },
      ipAddress: getClientIp(request),
    });
    return successResponse(warehouse);
  } catch (error) {
    if (error instanceof WarehouseError) return errorResponse(error.message, error.statusCode);
    logger.error('[admin/warehouses/[id]] PATCH failed', { error });
    return errorResponse('Помилка оновлення складу', 500);
  }
});

export const DELETE = withRole('admin')(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    await deleteWarehouse(numId);
    await logAudit({
      userId: user.id,
      actionType: 'data_delete',
      entityType: 'warehouse',
      entityId: numId,
      ipAddress: getClientIp(request),
    });
    return successResponse({ message: 'Склад видалено' });
  } catch (error) {
    if (error instanceof WarehouseError) return errorResponse(error.message, error.statusCode);
    logger.error('[admin/warehouses/[id]] DELETE failed', { error });
    return errorResponse('Помилка видалення складу', 500);
  }
});
