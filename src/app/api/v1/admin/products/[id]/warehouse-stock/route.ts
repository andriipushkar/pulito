import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';

/**
 * Reads per-warehouse stock for a product. Lists every active warehouse so the
 * UI can show 0 for warehouses that don't have a stock row yet — that way the
 * operator sees the full inventory layout, not a sparse view.
 */
export const GET = withRole(
  'admin',
  'manager',
)(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const productId = Number(id);
    if (isNaN(productId)) return errorResponse('Невалідний ID', 400);

    const [warehouses, stocks] = await Promise.all([
      prisma.warehouse.findMany({
        where: { isActive: true },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        select: { id: true, name: true, code: true, city: true, isDefault: true },
      }),
      prisma.warehouseStock.findMany({
        where: { productId },
        select: { warehouseId: true, quantity: true, reserved: true },
      }),
    ]);

    const stockMap = new Map(stocks.map((s) => [s.warehouseId, s]));
    const result = warehouses.map((w) => ({
      ...w,
      quantity: stockMap.get(w.id)?.quantity ?? 0,
      reserved: stockMap.get(w.id)?.reserved ?? 0,
    }));

    return successResponse(result);
  } catch (error) {
    console.error('[Warehouse stock GET]', error);
    return errorResponse('Помилка', 500);
  }
});

export const PATCH = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user, params }) => {
  try {
    const { id } = await params!;
    const productId = Number(id);
    if (isNaN(productId)) return errorResponse('Невалідний ID', 400);
    const body = (await request.json()) as { warehouseId?: unknown; quantity?: unknown };
    const warehouseId = Number(body.warehouseId);
    const quantity = Number(body.quantity);
    if (isNaN(warehouseId) || isNaN(quantity) || quantity < 0) {
      return errorResponse('Невалідні параметри', 400);
    }
    const previous = await prisma.warehouseStock.findUnique({
      where: { warehouseId_productId: { warehouseId, productId } },
      select: { quantity: true },
    });
    const updated = await prisma.warehouseStock.upsert({
      where: { warehouseId_productId: { warehouseId, productId } },
      update: { quantity },
      create: { warehouseId, productId, quantity },
    });
    await logAudit({
      userId: user.id,
      actionType: 'rule_change',
      entityType: 'warehouse_stock',
      entityId: productId,
      details: {
        warehouseId,
        productId,
        before: previous?.quantity ?? 0,
        after: quantity,
      },
      ipAddress: getClientIp(request),
    });
    return successResponse(updated);
  } catch (error) {
    console.error('[Warehouse stock PATCH]', error);
    return errorResponse('Помилка', 500);
  }
});
