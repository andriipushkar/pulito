import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';
import { unlinkSupplierProducts } from '@/services/suppliers/first-import';

const schema = z.object({
  productIds: z.array(z.number().int().positive()).min(1).max(2000),
});

/** Undo SKU→product links for a channel (clears supplierId + supplierSku). */
export const POST = withRole('admin')(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const result = await unlinkSupplierProducts(numId, parsed.data.productIds);
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'supplier_channel',
      entityId: numId,
      details: { action: 'unlink_products', unlinked: result.unlinked },
      ipAddress: getClientIp(request),
    });
    return successResponse(result);
  } catch (err) {
    logger.error('[admin/supplier-channels/[id]/unlink] failed', { error: err });
    return errorResponse('Не вдалося відв’язати товари', 500);
  }
});
