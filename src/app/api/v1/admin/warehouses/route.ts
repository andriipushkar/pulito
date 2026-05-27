import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { createWarehouse, getWarehouses, WarehouseError } from '@/services/warehouse';
import { createWarehouseSchema } from '@/validators/warehouse';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';

export const GET = withRole(
  'admin',
  'manager',
)(async () => {
  try {
    const warehouses = await getWarehouses();
    return successResponse(warehouses);
  } catch (err) {
    logger.error('[admin/warehouses] GET failed', { error: err });
    return errorResponse('Помилка завантаження складів', 500);
  }
});

export const POST = withRole('admin')(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = createWarehouseSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const warehouse = await createWarehouse(parsed.data);
    await logAudit({
      userId: user.id,
      actionType: 'data_create',
      entityType: 'warehouse',
      entityId: warehouse.id,
      details: {
        name: warehouse.name,
        code: warehouse.code,
        city: warehouse.city,
        isDefault: warehouse.isDefault,
      },
      ipAddress: getClientIp(request),
    });
    return successResponse(warehouse, 201);
  } catch (error) {
    if (error instanceof WarehouseError) return errorResponse(error.message, error.statusCode);
    logger.error('[admin/warehouses] POST failed', { error });
    return errorResponse('Помилка створення складу', 500);
  }
});
