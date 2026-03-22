import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getWarehouseById, updateStock, WarehouseError } from '@/services/warehouse';
import { updateStockSchema } from '@/validators/warehouse';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withRole('admin', 'manager')(
  async (_request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

      const warehouse = await getWarehouseById(numId);
      return successResponse(warehouse.stock);
    } catch (error) {
      if (error instanceof WarehouseError) return errorResponse(error.message, error.statusCode);
      return errorResponse('Помилка завантаження залишків', 500);
    }
  }
);

export const PUT = withRole('admin', 'manager')(
  async (request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

      const body = await request.json();
      const parsed = updateStockSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
      }

      const results = await updateStock(numId, parsed.data.items);
      return successResponse(results);
    } catch (error) {
      if (error instanceof WarehouseError) return errorResponse(error.message, error.statusCode);
      return errorResponse('Помилка оновлення залишків', 500);
    }
  }
);
