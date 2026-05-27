import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { getPalletById, updatePallet, deletePallet, PalletError } from '@/services/pallet';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  region: z.string().max(100).optional().nullable(),
  carrier: z.string().max(100).optional().nullable(),
  trackingNumber: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  // 50000 kg covers a realistic 40-pallet truckload; Decimal(8,2) caps at
  // 999999.99, so the smaller bound also protects against a typo turning
  // the cost calculator into a multi-million UAH delivery.
  weightKg: z.number().positive().max(50000).optional().nullable(),
  deliveryCost: z.number().nonnegative().max(10_000_000).optional().nullable(),
});

export const GET = withRole(
  'manager',
  'admin',
)(async (_req: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const pallet = await getPalletById(numId);
    if (!pallet) return errorResponse('Палету не знайдено', 404);
    return successResponse(pallet);
  } catch (err) {
    logger.error('[admin/pallets/[id]] GET failed', { error: err });
    return errorResponse('Помилка', 500);
  }
});

export const PUT = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const pallet = await updatePallet(numId, parsed.data);
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'pallet',
      entityId: numId,
      details: { fields: Object.keys(parsed.data) },
      ipAddress: getClientIp(request),
    });
    return successResponse(pallet);
  } catch (err) {
    if (err instanceof PalletError) return errorResponse(err.message, err.statusCode);
    logger.error('[admin/pallets/[id]] PUT failed', { error: err });
    return errorResponse('Не вдалося оновити', 500);
  }
});

export const DELETE = withRole('admin')(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    await deletePallet(numId);
    await logAudit({
      userId: user.id,
      actionType: 'data_delete',
      entityType: 'pallet',
      entityId: numId,
      ipAddress: getClientIp(request),
    });
    return successResponse({ deleted: true });
  } catch (err) {
    if (err instanceof PalletError) return errorResponse(err.message, err.statusCode);
    logger.error('[admin/pallets/[id]] DELETE failed', { error: err });
    return errorResponse('Не вдалося видалити', 500);
  }
});
