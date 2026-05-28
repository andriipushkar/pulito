import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import {
  updateVolumeDiscount,
  deleteVolumeDiscount,
  VolumePricingError,
} from '@/services/volume-pricing';
import { updateVolumeDiscountSchema } from '@/validators/volume-discount';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { prisma } from '@/lib/prisma';

export const PATCH = withRole('admin')(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const body = await request.json();
    const parsed = updateVolumeDiscountSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }

    // Snapshot the changed fields before the write so the audit row carries a
    // before/after diff — "what did this admin actually change" is otherwise
    // unrecoverable from a list of field names alone.
    const prev = (await prisma.volumeDiscount.findUnique({ where: { id: numId } })) as Record<
      string,
      unknown
    > | null;
    const changedFields = Object.keys(parsed.data);
    const before: Record<string, string | null> = {};
    const after: Record<string, string | null> = {};
    for (const k of changedFields) {
      before[k] = prev ? String(prev[k] ?? '') : null;
      after[k] = String((parsed.data as Record<string, unknown>)[k] ?? '');
    }

    const item = await updateVolumeDiscount(numId, parsed.data);
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'volume_discount',
      entityId: numId,
      details: { fields: changedFields, before, after },
    });
    return successResponse(item);
  } catch (error) {
    if (error instanceof VolumePricingError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/volume-discounts/[id]] PATCH failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const DELETE = withRole('admin')(async (_request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    await deleteVolumeDiscount(numId);
    await logAudit({
      userId: user.id,
      actionType: 'data_delete',
      entityType: 'volume_discount',
      entityId: numId,
    });
    return successResponse({ deleted: true });
  } catch (error) {
    if (error instanceof VolumePricingError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/volume-discounts/[id]] DELETE failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
