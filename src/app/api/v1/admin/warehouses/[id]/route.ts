import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getWarehouseById, updateWarehouse, deleteWarehouse, WarehouseError } from '@/services/warehouse';
import { updateWarehouseSchema } from '@/validators/warehouse';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withRole('admin', 'manager')(
  async (_request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

      const warehouse = await getWarehouseById(numId);
      return successResponse(warehouse);
    } catch (error) {
      if (error instanceof WarehouseError) return errorResponse(error.message, error.statusCode);
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);

export const PATCH = withRole('admin')(
  async (request: NextRequest, { params }) => {
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
      return successResponse(warehouse);
    } catch (error) {
      if (error instanceof WarehouseError) return errorResponse(error.message, error.statusCode);
      return errorResponse('Помилка оновлення складу', 500);
    }
  }
);

export const DELETE = withRole('admin')(
  async (_request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

      await deleteWarehouse(numId);
      return successResponse({ message: 'Склад видалено' });
    } catch (error) {
      if (error instanceof WarehouseError) return errorResponse(error.message, error.statusCode);
      return errorResponse('Помилка видалення складу', 500);
    }
  }
);
