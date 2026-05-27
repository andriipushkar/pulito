import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { updateStock, WarehouseError } from '@/services/warehouse';
import { updateStockSchema } from '@/validators/warehouse';
import { successResponse, errorResponse, paginatedResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

export const GET = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const sp = request.nextUrl.searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const limit = Math.min(200, Math.max(1, Number(sp.get('limit')) || 50));
    // Optional `?lowStock=N` filter — operators on inventory triage want
    // only items with quantity < N without scrolling the full list.
    const lowStockThreshold = sp.get('lowStock') ? Math.max(0, Number(sp.get('lowStock'))) : null;

    // Pre-fix this loaded ALL stock for a warehouse (50k rows possible
    // on a busy catalog) and emitted N+1 product joins. Now it paginates
    // and includes the product fields via Prisma `include`.
    const where = {
      warehouseId: numId,
      ...(lowStockThreshold !== null ? { quantity: { lt: lowStockThreshold } } : {}),
    };
    const [stock, total] = await Promise.all([
      prisma.warehouseStock.findMany({
        where,
        include: { product: { select: { id: true, name: true, code: true } } },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.warehouseStock.count({ where }),
    ]);
    return paginatedResponse(stock, total, page, limit);
  } catch (error) {
    if (error instanceof WarehouseError) return errorResponse(error.message, error.statusCode);
    logger.error('[admin/warehouses/[id]/stock] GET failed', { error });
    return errorResponse('Помилка завантаження залишків', 500);
  }
});

export const PUT = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    // Bulk stock PUT touches up to STOCK_BULK_LIMIT (500) upserts inside
    // a transaction with an advisory lock. 10/min per admin keeps a stuck
    // UI button from holding the lock + DB connection in a hot loop.
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.adminExport);
    if (!rl.allowed) {
      return errorResponse(
        `Забагато оновлень залишків. Спробуйте через ${Math.ceil(rl.retryAfter)} с.`,
        429,
      );
    }

    const body = await request.json();
    const parsed = updateStockSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const result = await updateStock(numId, parsed.data.items);

    // Audit-log carries the BEFORE snapshot so a rogue mass-edit leaves
    // a recoverable trail. The diff isn't pretty but it's enough to
    // restore the prior values manually.
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'warehouse_stock',
      entityId: numId,
      details: {
        warehouseId: numId,
        itemCount: parsed.data.items.length,
        updated: result.updated,
        before: result.before,
        after: parsed.data.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      },
      ipAddress: getClientIp(request),
    });

    return successResponse(result);
  } catch (error) {
    if (error instanceof WarehouseError) return errorResponse(error.message, error.statusCode);
    logger.error('[admin/warehouses/[id]/stock] PUT failed', { error });
    return errorResponse('Помилка оновлення залишків', 500);
  }
});
