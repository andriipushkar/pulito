import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';
import { createSupplierPayout } from '@/services/suppliers/reconciliation';

const schema = z.object({
  supplierId: z.number().int().positive(),
  amount: z.number().positive().max(99_999_999),
  note: z.string().max(500).optional().nullable(),
});

/** Record a settlement paid to a supplier (ledger entry for the reconciliation report). */
export const POST = withRole('admin')(async (request: NextRequest, { user }) => {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const res = await createSupplierPayout({ ...parsed.data, createdBy: user.id });
    await logAudit({
      userId: user.id,
      actionType: 'data_create',
      entityType: 'supplier_payout',
      entityId: res.id,
      details: { supplierId: parsed.data.supplierId, amount: parsed.data.amount },
      ipAddress: getClientIp(request),
    });
    return successResponse(res, 201);
  } catch (err) {
    logger.error('[admin/supplier-channels/payouts] POST failed', { error: err });
    return errorResponse('Не вдалося зберегти виплату', 500);
  }
});
