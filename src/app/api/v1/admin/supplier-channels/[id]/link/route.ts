import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';
import { linkSupplierProducts } from '@/services/suppliers/first-import';
import { SupplierChannelError } from '@/services/supplier-channel';

const schema = z.object({
  links: z
    .array(
      z
        .object({
          sku: z.string().min(1).max(255),
          productId: z.number().int().positive().optional(),
          productCode: z.string().min(1).max(255).optional(),
        })
        .refine((d) => d.productId != null || !!d.productCode, {
          message: 'Вкажіть товар (ID або код)',
        }),
    )
    .min(1)
    .max(2000),
});

/**
 * Confirm SKU→product links for a channel (the manual first-import step).
 * Stamps Product.supplierId + supplierSku so future syncs drive those products.
 */
export const POST = withRole('admin')(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const result = await linkSupplierProducts(numId, parsed.data.links);
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'supplier_channel',
      entityId: numId,
      details: { action: 'link_products', linked: result.linked, skipped: result.skipped.length },
      ipAddress: getClientIp(request),
    });
    return successResponse(result);
  } catch (err) {
    if (err instanceof SupplierChannelError) return errorResponse(err.message, err.statusCode);
    logger.error('[admin/supplier-channels/[id]/link] failed', { error: err });
    return errorResponse('Не вдалося прив’язати товари', 500);
  }
});
