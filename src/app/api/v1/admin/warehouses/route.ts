import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { createWarehouse, getWarehouses, WarehouseError } from '@/services/warehouse';
import { createWarehouseSchema } from '@/validators/warehouse';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withRole('admin', 'manager')(
  async () => {
    try {
      const warehouses = await getWarehouses();
      return successResponse(warehouses);
    } catch {
      return errorResponse('Помилка завантаження складів', 500);
    }
  }
);

export const POST = withRole('admin')(
  async (request: NextRequest) => {
    try {
      const body = await request.json();
      const parsed = createWarehouseSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
      }

      const warehouse = await createWarehouse(parsed.data);
      return successResponse(warehouse, 201);
    } catch (error) {
      if (error instanceof WarehouseError) return errorResponse(error.message, error.statusCode);
      return errorResponse('Помилка створення складу', 500);
    }
  }
);
